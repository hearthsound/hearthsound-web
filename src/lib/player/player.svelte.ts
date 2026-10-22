/**
 * The player.
 *
 * One audio element plays one track at a time from the queue. The player picks
 * the stream the browser can play, reports the play to the server when half the
 * track or four minutes have passed, publishes the browser's media session so
 * the system controls work, and declares the queue to the server so its
 * prefetch scheduler can look ahead. A stream that fails as a stored file is
 * retried once as a transcode; a failure after that is a toast, and the queue
 * stays where it is rather than skipping a track the user never heard.
 *
 * The side concerns live in their own modules: the media session in
 * `media-session.ts`, the queue declaration and its look-ahead in
 * `declaration.ts`, the stored choices in `settings.ts`, and the playback a
 * reload brings back in `restore.ts`.
 */
import type { ProgressState } from '#lib/labels';
import { availability } from '#lib/stores/availability.svelte';
import type { AvailabilityStore } from '#lib/stores/availability.svelte';
import { events, EVENTS_LOST_CODE } from '#lib/stores/events.svelte';
import type { EventOf, EventStream } from '#lib/stores/events.svelte';
import { toasts } from '#lib/stores/toasts.svelte';
import type { ToastStore } from '#lib/stores/toasts.svelte';
import { vendor } from '#lib/subsonic/vendor';
import type { VendorApi } from '#lib/subsonic/vendor';
import type { FailureReason } from '#lib/subsonic/types';

import { AcquireFlow } from './acquire.svelte';
import type { AudioLike } from './audio';
import { clientName } from './client';
import { QueueDeclaration } from './declaration';
import { MediaSessionPublisher } from './media-session';
import { PrefetchTracker } from './prefetch.svelte';
import { QueueStore } from './queue.svelte';
import type { QueueItem } from './queue.svelte';
import {
  clearStoredPlayback,
  PLAYBACK_POSITION_WRITE_SECS,
  playbackStorage,
  readStoredPlayback,
  writeStoredPlayback
} from './restore';
import type { PlaybackStorage, StoredPlayback } from './restore';
import { scrobbleThresholdReached } from './scrobble';
import {
  parsePlayerSettings,
  readStoredSettings,
  REPEAT_CYCLE,
  writeStoredSettings
} from './settings';
import type { RepeatMode } from './settings';
import { streamSource, streamUrl } from './stream';
import type { StreamFormat } from './stream';

/** Options of a {@link Player}. */
export interface PlayerOptions {
  /** The queue to play; a fresh one when absent. */
  queue?: QueueStore;
  /** The audio element to drive; the player creates one on first use. */
  audio?: AudioLike;
  /** The vendor calls to make. */
  api?: VendorApi;
  /** The event stream to follow. */
  events?: EventStream;
  /** The availability the player reads before it starts a track. */
  availability?: AvailabilityStore;
  /** The client instance name the server correlates queues by. */
  client?: string;
  /** The stack to report failures through. */
  toasts?: ToastStore;
  /**
   * Where the choices and the resumable playback are kept; the browser's local
   * storage when absent.
   */
  storage?: PlaybackStorage | null;
}

/** The client's player. */
export class Player {
  /** The queue the player walks through. */
  readonly queue: QueueStore;

  /** What the server is doing about each queued track. */
  readonly prefetch: PrefetchTracker;

  /** The client instance name the server correlates queues by. */
  readonly client: string;

  readonly #api: VendorApi;
  readonly #toasts: ToastStore;
  readonly #availability: AvailabilityStore;
  readonly #storage: PlaybackStorage | null;
  readonly #acquire: AcquireFlow;
  readonly #declaration: QueueDeclaration;
  readonly #media: MediaSessionPublisher;
  #element: AudioLike | null;
  #format: StreamFormat = 'mp3';
  #retried = false;
  #scrobbled = false;

  /** The account whose playback is kept, or `null` while none is known. */
  #userId: string | null = null;

  /** Whether the element holds a track the player started. */
  #loaded = false;

  /** The position a restore left for the first play, while nothing is loaded. */
  #resumed: { itemId: string; positionSecs: number } | null = null;

  /** The position the stored playback was last written with, in seconds. */
  #persistedPositionSecs = 0;

  /** Whether a restore is replacing the state, so nothing is written yet. */
  #restoring = false;

  /** Whether playback is running. */
  playing = $state(false);

  /** How far into the current track playback is, in seconds. */
  positionSecs = $state(0);

  /** The duration of the current track in seconds, or 0 while unknown. */
  durationSecs = $state(0);

  /** The output volume, from 0 to 1 (k35, PLY-06). */
  volume = $state(1);

  /** Whether the output is muted (k35, PLY-06). */
  muted = $state(false);

  /**
   * The repeat mode (fc3-diff, repeat3): `off`, `all` (the queue starts over
   * after its last track) or `song` (the current track starts over when it ends).
   */
  repeat = $state<RepeatMode>('off');

  /**
   * Builds a player.
   *
   * @param options The queue, element, calls and stream to use.
   */
  constructor(options: PlayerOptions = {}) {
    this.queue = options.queue ?? new QueueStore();
    this.client = options.client ?? clientName();
    this.prefetch = new PrefetchTracker(this.client);
    this.#api = options.api ?? vendor;
    this.#toasts = options.toasts ?? toasts;
    this.#availability = options.availability ?? availability;
    this.#storage = options.storage === undefined ? playbackStorage() : options.storage;
    const settings = parsePlayerSettings(readStoredSettings(this.#storage));
    this.volume = settings.volume;
    this.muted = settings.muted;
    this.repeat = settings.repeat;
    this.queue.setShuffle(settings.shuffle);
    this.#acquire = new AcquireFlow({
      api: this.#api,
      onReady: (playId) => this.#onAcquired(playId),
      onFailed: (message) => this.#toasts.push(message, 'error')
    });
    this.#declaration = new QueueDeclaration({
      api: this.#api,
      client: this.client,
      queue: this.queue,
      prefetch: this.prefetch
    });
    this.#media = new MediaSessionPublisher({
      toggle: () => this.toggle(),
      stop: () => this.stop(),
      previous: () => this.previous(),
      next: () => this.next(),
      seek: (positionSecs) => this.seek(positionSecs),
      position: () => this.#audioElement().currentTime
    });
    this.#element = options.audio ?? null;
    if (this.#element !== null) {
      this.#adopt(this.#element);
      this.#applyVolume();
    }
    const stream = options.events ?? events;
    stream.on('acquisition.updated', (event) => this.#onServerEvent(event));
    stream.on('track.availability', (event) => this.#onServerEvent(event));
    stream.on('queue.prefetch', (event) => this.#onServerEvent(event));
    stream.on('system.notice', (event) => {
      if (event.data.code === EVENTS_LOST_CODE) {
        void this.#acquire.resync();
      }
    });
    if (typeof window !== 'undefined') {
      // The page is going away: write the position the last time update saw,
      // because no later event will.
      window.addEventListener('pagehide', () => this.#persistPlayback());
    }
  }

  /** The id the client is acquiring, or `null` while nothing is. */
  get acquiringId(): string | null {
    return this.#acquire.requestedId;
  }

  /** What is happening to the track the client is waiting for, when it is. */
  get progress(): string | null {
    return this.#acquire.label;
  }

  /**
   * The acquisition state of the track the client is waiting for.
   *
   * The surfaces derive their pill and disc from this typed state rather than
   * from the progress label, so the wording and the controls cannot drift
   * apart.
   */
  get fetchProgress(): ProgressState | null {
    const status = this.#acquire.status;
    if (status.kind !== 'waiting') {
      return null;
    }
    return { state: status.state, percent: status.percent };
  }

  /** Why the current acquisition failed, or `null` while it has not failed. */
  get failureReason(): FailureReason | null {
    return this.#acquire.failureReason;
  }

  /** Whether the tracks after the current one play shuffled. */
  get shuffle(): boolean {
    return this.queue.shuffle;
  }

  /**
   * Sets the output volume, unmutes, and applies both to the element.
   *
   * @param volume The volume, from 0 to 1; values outside that range clamp.
   * @returns Nothing.
   */
  setVolume(volume: number): void {
    this.volume = Number.isFinite(volume) ? Math.min(1, Math.max(0, volume)) : 1;
    // Moving the volume is a request to hear the output (fc3-diff).
    this.muted = false;
    this.#applyVolume();
    this.#persistSettings();
  }

  /** Mutes or unmutes the output without changing the volume. */
  toggleMute(): void {
    this.muted = !this.muted;
    this.#applyVolume();
    this.#persistSettings();
  }

  /** Shuffles the tracks after the current one, or restores their order. */
  toggleShuffle(): void {
    this.setShuffle(!this.queue.shuffle);
  }

  /**
   * Brings back the playback the browser stored for an account.
   *
   * The queue, the current track and the position come back paused: restoring
   * loads no audio, asks the server for no track, reports no play and declares
   * no queue. The first play then resumes that track - from the stored
   * position when the server holds it, and from the start when it still has to
   * be acquired. An account without a usable stored entry starts empty, and a
   * corrupt entry is removed.
   *
   * @param userId The signed-in account's client id.
   * @returns Nothing.
   */
  restorePlayback(userId: string): void {
    const stored = readStoredPlayback(this.#storage, userId);
    this.#restoring = true;
    try {
      this.#userId = userId;
      this.#applyStoredPlayback(stored);
    } finally {
      this.#restoring = false;
    }
  }

  /**
   * Drops the playback stored for an account.
   *
   * The player also stops writing playback when that account was the one it
   * kept, so signing out leaves nothing behind for the next person at the
   * browser.
   *
   * @param userId The account whose stored playback to remove.
   * @returns Nothing.
   */
  forgetPlayback(userId: string): void {
    clearStoredPlayback(this.#storage, userId);
    if (this.#userId === userId) {
      this.#userId = null;
    }
  }

  /**
   * Turns the shuffled order on or off.
   *
   * A collection's Play turns it off so the collection plays in its own order;
   * its Shuffle turns it on, which is also the state the player's button shows
   * (queue-order).
   *
   * @param on Whether the upcoming tracks play shuffled.
   * @returns Nothing.
   */
  setShuffle(on: boolean): void {
    if (this.queue.shuffle === on) {
      return;
    }
    this.queue.setShuffle(on);
    this.#declaration.schedule();
    this.#persistSettings();
    this.#persistPlayback();
  }

  /** Moves to the next repeat mode: off, then all, then song, then off again. */
  cycleRepeat(): void {
    this.repeat = REPEAT_CYCLE[this.repeat];
    this.#persistSettings();
  }

  /**
   * Replaces the queue and starts playing one of its tracks.
   *
   * @param items The tracks to play, in order.
   * @param startIndex The index to start at.
   * @returns Nothing.
   */
  play(items: readonly QueueItem[], startIndex = 0): void {
    this.#resumed = null;
    this.queue.play(items, startIndex);
    this.#beginCurrent();
  }

  /**
   * Pauses playback, or resumes it.
   *
   * After a restore nothing is loaded yet, so the first press starts the track
   * the bar shows rather than resuming an empty element.
   *
   * @returns Nothing.
   */
  toggle(): void {
    if (!this.#loaded) {
      this.#beginCurrent();
      return;
    }
    const element = this.#audioElement();
    if (element.paused) {
      void this.#resume(element);
    } else {
      element.pause();
    }
  }

  /**
   * Plays the next track of the queue.
   *
   * Next always moves on, also while one song repeats (repeat-revert). The end
   * of the queue stops playback, unless the whole queue repeats, in which case
   * it starts over from the first track (a new shuffle when shuffle is on).
   *
   * @returns Nothing.
   */
  next(): void {
    if (this.queue.next() === null) {
      if (this.repeat === 'all' && this.queue.items.length > 0) {
        this.queue.rewind();
        this.#beginCurrent();
        return;
      }
      this.#audioElement().pause();
      return;
    }
    this.#beginCurrent();
  }

  /**
   * Restarts the current track, or steps back to the previous one.
   *
   * @returns Nothing.
   */
  previous(): void {
    if (this.queue.current === null) {
      return;
    }
    const before = this.queue.current;
    // Before a restore has started anything there is no element position yet,
    // so the position the bar shows decides whether this restarts the track.
    const position = this.#loaded ? this.#audioElement().currentTime : this.positionSecs;
    this.queue.previous(position);
    if (this.queue.current?.id === before.id) {
      // The same track restarts, so a restored position must not come back.
      this.#resumed = null;
    }
    this.#beginCurrent();
  }

  /**
   * Stops playback and rewinds.
   *
   * @returns Nothing.
   */
  stop(): void {
    const element = this.#audioElement();
    element.pause();
    element.currentTime = 0;
    this.positionSecs = 0;
    this.#resumed = null;
    this.#persistPlayback();
  }

  /**
   * Moves playback to a position.
   *
   * Before a restore has started anything, the position moves on the bar and
   * in the stored playback only, because no stream is loaded yet.
   *
   * @param positionSecs The position to move to, clamped into the track.
   * @returns Nothing.
   */
  seek(positionSecs: number): void {
    if (!this.#loaded) {
      const end = this.durationSecs > 0 ? this.durationSecs : positionSecs;
      const position = Math.min(Math.max(positionSecs, 0), end);
      this.positionSecs = position;
      if (this.#resumed !== null) {
        this.#resumed = { ...this.#resumed, positionSecs: position };
      }
      this.#persistPlayback(position);
      return;
    }
    const element = this.#audioElement();
    const end = Number.isFinite(element.duration) ? element.duration : positionSecs;
    const position = Math.min(Math.max(positionSecs, 0), end);
    element.currentTime = position;
    this.#persistPlayback(position);
  }

  /**
   * Appends tracks to the queue.
   *
   * @param items The tracks to append, in order.
   * @returns Nothing.
   */
  append(items: readonly QueueItem[]): void {
    this.queue.append(items);
    this.#declaration.schedule();
    this.#persistPlayback();
  }

  /**
   * Puts a track next in line.
   *
   * @param item The track to insert.
   * @returns Nothing.
   */
  playNext(item: QueueItem): void {
    this.queue.playNext(item);
    this.#declaration.schedule();
    this.#persistPlayback();
  }

  /**
   * Removes a track from the queue.
   *
   * @param index The index to remove.
   * @returns Nothing.
   */
  remove(index: number): void {
    this.queue.remove(index);
    this.#declaration.schedule();
    this.#persistPlayback();
  }

  /**
   * Moves a track to another position in the queue.
   *
   * @param from The index to move.
   * @param to The index to move it to.
   * @returns Nothing.
   */
  move(from: number, to: number): void {
    this.queue.move(from, to);
    this.#declaration.schedule();
    this.#persistPlayback();
  }

  /**
   * Moves on when a track ends on its own: the same track again while one song
   * repeats, otherwise what Next does.
   *
   * @returns Nothing.
   */
  #onEnded(): void {
    if (this.repeat === 'song' && this.queue.current !== null) {
      this.#beginCurrent();
      return;
    }
    this.next();
  }

  /**
   * Registers the element's listeners.
   *
   * @param element The element to listen to.
   * @returns Nothing.
   */
  #adopt(element: AudioLike): void {
    element.addEventListener('timeupdate', () => this.#onTimeUpdate());
    element.addEventListener('ended', () => this.#onEnded());
    element.addEventListener('play', () => {
      this.playing = true;
      this.#media.syncState(this.playing);
    });
    element.addEventListener('pause', () => {
      this.playing = false;
      this.#media.syncState(this.playing);
      this.#persistPlayback();
    });
    element.addEventListener('error', () => this.#onError());
  }

  /**
   * Returns the audio element, creating it on first use.
   *
   * @returns The element.
   */
  #audioElement(): AudioLike {
    if (this.#element === null) {
      const element = new Audio();
      element.preload = 'auto';
      this.#element = element;
      this.#adopt(element);
      this.#applyVolume();
    }
    return this.#element;
  }

  /** Writes the volume and mute choice onto the element. */
  #applyVolume(): void {
    if (this.#element !== null) {
      this.#element.volume = this.volume;
      this.#element.muted = this.muted;
    }
  }

  /** Stores the volume and mute choice for this browser. */
  #persistSettings(): void {
    writeStoredSettings(this.#storage, {
      volume: this.volume,
      muted: this.muted,
      shuffle: this.queue.shuffle,
      repeat: this.repeat
    });
  }

  /**
   * Replaces the player's state with a stored playback, or with nothing.
   *
   * Nothing is loaded and nothing is requested: the bar shows the stored track
   * and position, and the first play starts it.
   *
   * @param stored The playback to bring back, or `null` when nothing usable is
   *   stored.
   * @returns Nothing.
   */
  #applyStoredPlayback(stored: StoredPlayback | null): void {
    this.#element?.pause();
    this.#acquire.clear();
    this.#media.syncState(false);
    this.#loaded = false;
    this.playing = false;
    if (stored === null) {
      this.queue.restore([], -1, null);
      this.positionSecs = 0;
      this.durationSecs = 0;
      this.#resumed = null;
      this.#persistedPositionSecs = 0;
      return;
    }
    this.queue.restore(stored.items, stored.currentIndex, stored.original);
    const item = this.queue.current;
    const duration = item?.durationSecs ?? 0;
    const position = duration > 0 ? Math.min(stored.positionSecs, duration) : stored.positionSecs;
    this.positionSecs = position;
    this.durationSecs = duration;
    this.#resumed = item === null ? null : { itemId: item.id, positionSecs: position };
    this.#persistedPositionSecs = position;
  }

  /**
   * Writes the playback for the signed-in account.
   *
   * The position is passed separately when the element's position is not the
   * one to keep, which is the case while the next track is being acquired and
   * on a seek before anything is loaded.
   *
   * @param positionSecs The position to store, in seconds; the current one
   *   when absent.
   * @returns Nothing.
   */
  #persistPlayback(positionSecs: number = this.positionSecs): void {
    if (this.#userId === null || this.#restoring) {
      return;
    }
    writeStoredPlayback(this.#storage, this.#userId, {
      items: this.queue.items,
      currentIndex: this.queue.currentIndex,
      positionSecs,
      original: this.queue.originalItems === null ? null : [...this.queue.originalItems]
    });
    this.#persistedPositionSecs = positionSecs;
  }

  /**
   * Starts the track that is current in the queue.
   *
   * A track the server holds is played; one it does not is acquired first, and
   * the flow plays it once it is there. A track nothing was heard about is
   * played as it is, because nothing said it is not on the server. A restored
   * track resumes at the stored position when the server holds it; a track
   * that still has to be acquired starts from the beginning once it is there.
   *
   * @returns Nothing.
   */
  #beginCurrent(): void {
    const item = this.queue.current;
    if (item === null) {
      this.#acquire.clear();
      this.#persistPlayback();
      return;
    }
    const resumed =
      this.#resumed !== null && this.#resumed.itemId === item.id ? this.#resumed.positionSecs : 0;
    this.#resumed = null;
    const state = this.#availability.of(item);
    if (state === null || state === 'local' || state === 'cached') {
      this.#start(item, resumed);
      return;
    }
    this.#element?.pause();
    this.#persistPlayback(0);
    void this.#acquire.request(item.id);
  }

  /**
   * Plays the track an acquisition produced, when the user still waits for it.
   *
   * @param playId The id the track can be streamed from.
   * @returns Nothing.
   */
  #onAcquired(playId: string): void {
    const item = this.queue.current;
    if (item !== null && item.id === this.#acquire.requestedId) {
      this.#start({ ...item, id: playId });
    }
  }

  /**
   * Loads a track into the element and starts playing it.
   *
   * @param item The track to play.
   * @param positionSecs The position to start from, in seconds; the beginning
   *   when absent.
   * @returns Nothing.
   */
  #start(item: QueueItem, positionSecs = 0): void {
    const element = this.#audioElement();
    const source = streamSource(item, (type) => element.canPlayType(type));
    this.#format = source.format;
    this.#retried = false;
    this.#scrobbled = false;
    this.#acquire.clear();
    this.positionSecs = positionSecs;
    this.durationSecs = item.durationSecs ?? 0;
    element.src = source.url;
    element.currentTime = positionSecs;
    this.#loaded = true;
    void this.#resume(element);
    this.#media.publishMetadata(item);
    void this.#report(item);
    this.#declaration.schedule();
    this.#persistPlayback();
  }

  /**
   * Starts playback, reporting a refusal as a toast.
   *
   * @param element The element to play.
   * @returns Nothing.
   */
  async #resume(element: AudioLike): Promise<void> {
    try {
      await element.play();
    } catch {
      this.#toasts.push('Playback did not start.', 'error');
    }
  }

  /**
   * Reports that a track started playing.
   *
   * @param item The track that started.
   * @returns Nothing.
   */
  async #report(item: QueueItem): Promise<void> {
    try {
      await this.#api.scrobble(item.id, false);
    } catch {
      this.#toasts.push(`Could not report ${item.title} as playing.`, 'warn');
    }
  }

  /**
   * Applies one server event.
   *
   * @param event The event to apply.
   * @returns Nothing.
   */
  #onServerEvent(
    event:
      EventOf<'acquisition.updated'> | EventOf<'track.availability'> | EventOf<'queue.prefetch'>
  ): void {
    this.prefetch.apply(event);
    if (event.type !== 'queue.prefetch') {
      this.#acquire.apply(event);
    }
  }

  /**
   * Follows the element's position and reports the play when it is due.
   *
   * @returns Nothing.
   */
  #onTimeUpdate(): void {
    const element = this.#audioElement();
    this.positionSecs = element.currentTime;
    if (Number.isFinite(element.duration)) {
      this.durationSecs = element.duration;
    }
    const item = this.queue.current;
    if (
      item !== null &&
      !this.#scrobbled &&
      scrobbleThresholdReached(element.currentTime, element.duration)
    ) {
      this.#scrobbled = true;
      void this.#api.scrobble(item.id, true).catch(() => undefined);
    }
    this.#media.publishPosition(element.currentTime, element.duration);
    if (
      this.#userId !== null &&
      Math.abs(element.currentTime - this.#persistedPositionSecs) >= PLAYBACK_POSITION_WRITE_SECS
    ) {
      this.#persistPlayback();
    }
  }

  /**
   * Reacts to a stream that failed, retrying a stored file once as a transcode.
   *
   * @returns Nothing.
   */
  #onError(): void {
    const item = this.queue.current;
    if (item === null) {
      return;
    }
    if (this.#format === 'raw' && !this.#retried) {
      this.#retried = true;
      this.#format = 'mp3';
      const element = this.#audioElement();
      element.src = streamUrl(item.id, 'mp3');
      void this.#resume(element);
      return;
    }
    this.playing = false;
    this.#toasts.push(`Could not play ${item.title}.`, 'error');
  }
}

/** The player of the running client. */
export const player = new Player();
