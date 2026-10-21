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
 */
import { availability } from '#lib/stores/availability.svelte';
import type { AvailabilityStore } from '#lib/stores/availability.svelte';
import { events } from '#lib/stores/events.svelte';
import type { EventOf, EventStream } from '#lib/stores/events.svelte';
import { toasts } from '#lib/stores/toasts.svelte';
import type { ToastStore } from '#lib/stores/toasts.svelte';
import { vendor } from '#lib/subsonic/vendor';
import type { VendorApi } from '#lib/subsonic/vendor';

import { AcquireFlow } from './acquire.svelte';
import { PrefetchTracker } from './prefetch.svelte';
import { QueueStore } from './queue.svelte';
import type { QueueItem } from './queue.svelte';
import { COVER_ART_SIZE, coverArtUrl, streamSource, streamUrl } from './stream';
import type { StreamFormat } from './stream';

/** The parts of an audio element the player drives. */
export interface AudioLike {
  /** The URL of the loaded media. */
  src: string;
  /** How far into the media playback is, in seconds. */
  currentTime: number;
  /** The duration of the media in seconds, or `NaN` while it is unknown. */
  duration: number;
  /** Whether playback is paused. */
  paused: boolean;
  /** The output volume, from 0 to 1. */
  volume: number;
  /** Whether the output is muted. */
  muted: boolean;
  /**
   * Reports how well the browser can play a MIME type.
   *
   * @param type The MIME type.
   * @returns `probably`, `maybe`, or an empty string when it cannot.
   */
  canPlayType(type: string): string;
  /**
   * Starts or resumes playback.
   *
   * @returns A promise that rejects when playback was refused.
   */
  play(): Promise<void> | void;
  /** Pauses playback. */
  pause(): void;
  /**
   * Registers a listener for a media event.
   *
   * @param type The event name.
   * @param listener The listener to call.
   */
  addEventListener(type: string, listener: (event: Event) => void): void;
}

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
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

/** The key this tab's client instance name is kept under. */
export const CLIENT_NAME_KEY = 'hearthsound-web.client';

/** The key the player choices are kept under (k35, PLY-06, repeat-persist). */
export const PLAYER_SETTINGS_KEY = 'hearthsound.player';

/** How the queue repeats (fc3-diff, repeat3). */
export type RepeatMode = 'off' | 'all' | 'song';

/** The repeat mode each press of the repeat button moves to. */
const REPEAT_CYCLE: Record<RepeatMode, RepeatMode> = { off: 'all', all: 'song', song: 'off' };

/** The player choices the browser keeps. */
export interface PlayerSettings {
  /** The output volume, from 0 to 1. */
  volume: number;
  /** Whether the output is muted. */
  muted: boolean;
  /** Whether the upcoming tracks play shuffled. */
  shuffle: boolean;
  /** How the queue repeats. */
  repeat: RepeatMode;
}

/** The settings an absent or unreadable stored value falls back to. */
const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  volume: 1,
  muted: false,
  shuffle: false,
  repeat: 'off'
};

/**
 * Reads the stored player choices.
 *
 * Each value that is missing, unreadable or out of range falls back on its
 * own: full volume, unmuted, shuffle off, repeat off (k35, PLY-06,
 * repeat-persist).
 *
 * @param raw The stored JSON text, or `null` when nothing is stored.
 * @returns The settings to apply.
 */
export function parsePlayerSettings(raw: string | null): PlayerSettings {
  if (raw === null) {
    return { ...DEFAULT_PLAYER_SETTINGS };
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      return { ...DEFAULT_PLAYER_SETTINGS };
    }
    const volume =
      'volume' in value &&
      typeof value.volume === 'number' &&
      Number.isFinite(value.volume) &&
      value.volume >= 0 &&
      value.volume <= 1
        ? value.volume
        : DEFAULT_PLAYER_SETTINGS.volume;
    const muted =
      'muted' in value && typeof value.muted === 'boolean'
        ? value.muted
        : DEFAULT_PLAYER_SETTINGS.muted;
    const shuffle =
      'shuffle' in value && typeof value.shuffle === 'boolean'
        ? value.shuffle
        : DEFAULT_PLAYER_SETTINGS.shuffle;
    const repeat =
      'repeat' in value && typeof value.repeat === 'string' && value.repeat in REPEAT_CYCLE
        ? (value.repeat as RepeatMode)
        : DEFAULT_PLAYER_SETTINGS.repeat;
    return { volume, muted, shuffle, repeat };
  } catch {
    return { ...DEFAULT_PLAYER_SETTINGS };
  }
}

/** The delay before a changed queue is declared, in milliseconds. */
export const QUEUE_DECLARE_DELAY_MS = 500;

/** The delay before a declared queue is checked for running acquisitions. */
export const PREFETCH_DELAY_MS = 1000;

/** How many upcoming items a queue declaration looks ahead at. */
export const PREFETCH_LOOKAHEAD = 3;

/** What a media-key seek moves by when the system sends no offset, in seconds. */
export const SEEK_OFFSET_SECS = 10;

/** The position at which a play is reported, in seconds. */
export const SCROBBLE_FLOOR_SECS = 240;

/** How often the media session position is published, in milliseconds. */
export const POSITION_UPDATE_MS = 1000;

/**
 * Reports whether a play has run long enough to be recorded.
 *
 * A play is recorded once half the track or {@link SCROBBLE_FLOOR_SECS} have
 * passed, whichever comes first; a track of unknown length is held to the floor.
 *
 * @param positionSecs How far into the track playback is.
 * @param durationSecs The track's duration, or a non-finite value while it is
 *   unknown.
 * @returns `true` when the play should be recorded.
 */
export function scrobbleThresholdReached(positionSecs: number, durationSecs: number): boolean {
  const half =
    Number.isFinite(durationSecs) && durationSecs > 0 ? durationSecs / 2 : SCROBBLE_FLOOR_SECS;
  return positionSecs >= Math.min(half, SCROBBLE_FLOOR_SECS);
}

/**
 * Returns the browser's media session.
 *
 * @returns The session, or `null` in an environment without one.
 */
function mediaSession(): MediaSession | null {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
    return null;
  }
  return navigator.mediaSession;
}

/**
 * Returns the storage this tab's client name is kept in.
 *
 * @returns The session storage, or `null` outside a browser.
 */
function browserStorage(): Storage | null {
  return typeof sessionStorage === 'undefined' ? null : sessionStorage;
}

/**
 * Returns the browser's settings storage.
 *
 * @returns The local storage, or `null` when it is absent or blocked.
 */
function settingsStorage(): Pick<Storage, 'getItem' | 'setItem'> | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Builds a fresh client instance name.
 *
 * @returns A name of the form `hearthsound-web-<8 hex characters>`.
 */
function randomClientName(): string {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `hearthsound-web-${hex}`;
}

/**
 * Returns this tab's client instance name, creating it once per tab.
 *
 * @param storage The storage to keep the name in.
 * @returns The name.
 */
export function clientName(storage: Storage | null = browserStorage()): string {
  const existing = storage?.getItem(CLIENT_NAME_KEY) ?? null;
  if (existing !== null) {
    return existing;
  }
  const name = randomClientName();
  storage?.setItem(CLIENT_NAME_KEY, name);
  return name;
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

  /** Whether playback is running. */
  playing = $state(false);

  /** How far into the current track playback is, in seconds. */
  positionSecs = $state(0);

  /** The duration of the current track in seconds, or 0 while unknown. */
  durationSecs = $state(0);

  /** The output volume, from 0 to 1 (k35, PLY-06). */
  volume = $state(DEFAULT_PLAYER_SETTINGS.volume);

  /** Whether the output is muted (k35, PLY-06). */
  muted = $state(DEFAULT_PLAYER_SETTINGS.muted);

  /**
   * The repeat mode (fc3-diff, repeat3): `off`, `all` (the queue starts over
   * after its last track) or `song` (the current track starts over when it ends).
   */
  repeat = $state<RepeatMode>('off');

  readonly #availability: AvailabilityStore;
  readonly #settings: Pick<Storage, 'getItem' | 'setItem'> | null;
  readonly #acquire: AcquireFlow;
  #element: AudioLike | null;
  #format: StreamFormat = 'mp3';
  #retried = false;
  #scrobbled = false;
  #declareGeneration = 0;
  #lookaheadGeneration = 0;
  #positionPublishedAt = 0;

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
    const settings = parsePlayerSettings(this.#readSettings());
    this.volume = settings.volume;
    this.muted = settings.muted;
    this.repeat = settings.repeat;
    this.queue.setShuffle(settings.shuffle);
    this.#acquire = new AcquireFlow({
      api: this.#api,
      onReady: (playId) => this.#onAcquired(playId),
      onFailed: (message) => this.#toasts.push(message, 'error')
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
      if (event.data.code === 'events-lost') {
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
    this.#scheduleDeclaration();
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
    this.#scheduleDeclaration();
  }

  /**
   * Puts a track next in line.
   *
   * @param item The track to insert.
   * @returns Nothing.
   */
  playNext(item: QueueItem): void {
    this.queue.playNext(item);
    this.#scheduleDeclaration();
  }

  /**
   * Removes a track from the queue.
   *
   * @param index The index to remove.
   * @returns Nothing.
   */
  remove(index: number): void {
    this.queue.remove(index);
    this.#scheduleDeclaration();
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
    this.#scheduleDeclaration();
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
      this.#syncMediaSessionState();
    });
    element.addEventListener('pause', () => {
      this.playing = false;
      this.#syncMediaSessionState();
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

  /** Reads the stored settings, treating a blocked storage as absent. */
  #readSettings(): string | null {
    try {
      return this.#settings?.getItem(PLAYER_SETTINGS_KEY) ?? null;
    } catch {
      return null;
    }
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
    try {
      this.#settings?.setItem(
        PLAYER_SETTINGS_KEY,
        JSON.stringify({
          volume: this.volume,
          muted: this.muted,
          shuffle: this.queue.shuffle,
          repeat: this.repeat
        } satisfies PlayerSettings)
      );
    } catch {
      // A storage that refuses the write keeps the choice for this session.
    }
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
    this.#publishMetadata(item);
    void this.#report(item);
    this.#scheduleDeclaration();
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
    this.#publishPosition(element);
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

  /**
   * Publishes the track's metadata and controls to the media session.
   *
   * @param item The track that started.
   * @returns Nothing.
   */
  #publishMetadata(item: QueueItem): void {
    const session = mediaSession();
    if (session === null) {
      return;
    }
    const coverArt = item.coverArt ?? '';
    session.metadata = new MediaMetadata({
      title: item.title,
      artist: item.artist ?? '',
      album: item.album ?? '',
      artwork:
        coverArt === ''
          ? []
          : [
              {
                src: coverArtUrl(coverArt, COVER_ART_SIZE),
                sizes: `${COVER_ART_SIZE}x${COVER_ART_SIZE}`
              }
            ]
    });
    session.setActionHandler('play', () => this.toggle());
    session.setActionHandler('pause', () => this.toggle());
    session.setActionHandler('stop', () => this.stop());
    session.setActionHandler('previoustrack', () => this.previous());
    session.setActionHandler('nexttrack', () => this.next());
    session.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        this.seek(details.seekTime);
      }
    });
    session.setActionHandler('seekbackward', (details) =>
      this.seek(this.#audioElement().currentTime - (details.seekOffset ?? SEEK_OFFSET_SECS))
    );
    session.setActionHandler('seekforward', (details) =>
      this.seek(this.#audioElement().currentTime + (details.seekOffset ?? SEEK_OFFSET_SECS))
    );
  }

  /**
   * Mirrors the playback state onto the media session.
   *
   * @returns Nothing.
   */
  #syncMediaSessionState(): void {
    const session = mediaSession();
    if (session !== null) {
      session.playbackState = this.playing ? 'playing' : 'paused';
    }
  }

  /**
   * Publishes the playback position to the media session, at most once a second.
   *
   * @param element The element that plays.
   * @returns Nothing.
   */
  #publishPosition(element: AudioLike): void {
    const session = mediaSession();
    if (session === null || typeof session.setPositionState !== 'function') {
      return;
    }
    const now = Date.now();
    if (now - this.#positionPublishedAt < POSITION_UPDATE_MS) {
      return;
    }
    if (!Number.isFinite(element.duration) || element.duration <= 0) {
      return;
    }
    this.#positionPublishedAt = now;
    try {
      session.setPositionState({
        duration: element.duration,
        playbackRate: 1,
        position: Math.min(element.currentTime, element.duration)
      });
    } catch {
      // The position state is advisory; a rejected one changes nothing.
    }
  }

  /**
   * Schedules the queue declaration.
   *
   * A queue that changes again before the delay elapses is declared once, with
   * its latest shape.
   *
   * @returns Nothing.
   */
  #scheduleDeclaration(): void {
    const generation = ++this.#declareGeneration;
    setTimeout(() => {
      if (generation === this.#declareGeneration) {
        void this.#declare();
      }
    }, QUEUE_DECLARE_DELAY_MS);
  }

  /**
   * Declares the queue to the server and looks ahead at the next items.
   *
   * A queue with nothing after the current track is not declared: the scheduler
   * has nothing to look ahead at.
   *
   * @returns Nothing.
   */
  async #declare(): Promise<void> {
    const current = this.queue.current;
    if (current === null) {
      return;
    }
    const next = this.queue.following.map((item) => item.id);
    if (next.length === 0) {
      return;
    }
    try {
      await this.#api.setQueue(current.id, next, this.client);
    } catch {
      return;
    }
    const generation = ++this.#lookaheadGeneration;
    setTimeout(() => {
      if (generation === this.#lookaheadGeneration) {
        void this.#lookahead();
      }
    }, PREFETCH_DELAY_MS);
  }

  /**
   * Reads the availability of the upcoming items.
   *
   * @returns Nothing.
   */
  async #lookahead(): Promise<void> {
    const ids = this.queue.following.slice(0, PREFETCH_LOOKAHEAD).map((item) => item.id);
    if (ids.length === 0) {
      return;
    }
    try {
      this.prefetch.adopt(await this.#api.getAvailability(ids));
    } catch {
      // The next declaration reads again.
    }
  }
}

/** The player of the running client. */
export const player = new Player();
