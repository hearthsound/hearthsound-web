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
 * The three side concerns live in their own modules: the media session in
 * `media-session.ts`, the queue declaration and its look-ahead in
 * `declaration.ts`, and the stored choices in `settings.ts`.
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
import { scrobbleThresholdReached } from './scrobble';
import {
  parsePlayerSettings,
  readStoredSettings,
  REPEAT_CYCLE,
  settingsStorage,
  writeStoredSettings
} from './settings';
import type { RepeatMode, SettingsStorage } from './settings';
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
  /** Where the volume and mute choice are kept; the browser's store when absent. */
  storage?: SettingsStorage | null;
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
  readonly #settings: SettingsStorage | null;
  readonly #acquire: AcquireFlow;
  readonly #declaration: QueueDeclaration;
  readonly #media: MediaSessionPublisher;
  #element: AudioLike | null;
  #format: StreamFormat = 'mp3';
  #retried = false;
  #scrobbled = false;

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
    this.#settings = options.storage === undefined ? settingsStorage() : options.storage;
    const settings = parsePlayerSettings(readStoredSettings(this.#settings));
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
    this.queue.play(items, startIndex);
    this.#beginCurrent();
  }

  /**
   * Pauses playback, or resumes it.
   *
   * @returns Nothing.
   */
  toggle(): void {
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
    this.queue.previous(this.#audioElement().currentTime);
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
  }

  /**
   * Moves playback to a position.
   *
   * @param positionSecs The position to move to, clamped into the track.
   * @returns Nothing.
   */
  seek(positionSecs: number): void {
    const element = this.#audioElement();
    const end = Number.isFinite(element.duration) ? element.duration : positionSecs;
    element.currentTime = Math.min(Math.max(positionSecs, 0), end);
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
    writeStoredSettings(this.#settings, {
      volume: this.volume,
      muted: this.muted,
      shuffle: this.queue.shuffle,
      repeat: this.repeat
    });
  }

  /**
   * Starts the track that is current in the queue.
   *
   * A track the server holds is played; one it does not is acquired first, and
   * the flow plays it once it is there. A track nothing was heard about is
   * played as it is, because nothing said it is not on the server.
   *
   * @returns Nothing.
   */
  #beginCurrent(): void {
    const item = this.queue.current;
    if (item === null) {
      this.#acquire.clear();
      return;
    }
    const state = this.#availability.of(item);
    if (state === null || state === 'local' || state === 'cached') {
      this.#start(item);
      return;
    }
    this.#element?.pause();
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
   * @returns Nothing.
   */
  #start(item: QueueItem): void {
    const element = this.#audioElement();
    const source = streamSource(item, (type) => element.canPlayType(type));
    this.#format = source.format;
    this.#retried = false;
    this.#scrobbled = false;
    this.#acquire.clear();
    this.positionSecs = 0;
    this.durationSecs = item.durationSecs ?? 0;
    element.src = source.url;
    element.currentTime = 0;
    void this.#resume(element);
    this.#media.publishMetadata(item);
    void this.#report(item);
    this.#declaration.schedule();
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
