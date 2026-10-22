/**
 * The browser's media session, as the player publishes to it.
 *
 * The media session is what puts the playing track on the lock screen, in the
 * system's media controls and on a headset's buttons. The player publishes the
 * track's metadata once when it starts, mirrors each play and pause, and
 * reports the position at most once a second; the system then drives playback
 * back through the controls the player hands over here.
 */
import { COVER_ART_SIZE, coverArtUrl } from './stream';
import type { QueueItem } from './queue.svelte';

/** What a media-key seek moves by when the system sends no offset, in seconds. */
const SEEK_OFFSET_SECS = 10;

/** How often the media session position is published, in milliseconds. */
const POSITION_UPDATE_MS = 1000;

/** The player the media session drives. */
export interface MediaSessionControls {
  /** Pauses playback, or resumes it. */
  toggle(): void;
  /** Stops playback and rewinds. */
  stop(): void;
  /** Restarts the current track, or steps back to the previous one. */
  previous(): void;
  /** Plays the next track of the queue. */
  next(): void;
  /**
   * Moves playback to a position, clamped into the track.
   *
   * @param positionSecs The position to move to.
   */
  seek(positionSecs: number): void;
  /**
   * Reports how far into the track playback is.
   *
   * @returns The position in seconds.
   */
  position(): number;
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

/** Publishes the playing track and its playback state to the media session. */
export class MediaSessionPublisher {
  readonly #controls: MediaSessionControls;
  #positionPublishedAt = 0;

  /**
   * Builds a publisher.
   *
   * @param controls The player controls the system drives.
   */
  constructor(controls: MediaSessionControls) {
    this.#controls = controls;
  }

  /**
   * Publishes the track's metadata and controls to the media session.
   *
   * @param item The track that started.
   * @returns Nothing.
   */
  publishMetadata(item: QueueItem): void {
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
    session.setActionHandler('play', () => this.#controls.toggle());
    session.setActionHandler('pause', () => this.#controls.toggle());
    session.setActionHandler('stop', () => this.#controls.stop());
    session.setActionHandler('previoustrack', () => this.#controls.previous());
    session.setActionHandler('nexttrack', () => this.#controls.next());
    session.setActionHandler('seekto', (details) => {
      if (typeof details.seekTime === 'number') {
        this.#controls.seek(details.seekTime);
      }
    });
    session.setActionHandler('seekbackward', (details) =>
      this.#controls.seek(this.#controls.position() - (details.seekOffset ?? SEEK_OFFSET_SECS))
    );
    session.setActionHandler('seekforward', (details) =>
      this.#controls.seek(this.#controls.position() + (details.seekOffset ?? SEEK_OFFSET_SECS))
    );
  }

  /**
   * Mirrors the playback state onto the media session.
   *
   * @param playing Whether playback is running.
   * @returns Nothing.
   */
  syncState(playing: boolean): void {
    const session = mediaSession();
    if (session !== null) {
      session.playbackState = playing ? 'playing' : 'paused';
    }
  }

  /**
   * Publishes the playback position to the media session, at most once a second.
   *
   * @param positionSecs How far into the track playback is.
   * @param durationSecs The track's duration, or a non-finite value while it is
   *   unknown.
   * @returns Nothing.
   */
  publishPosition(positionSecs: number, durationSecs: number): void {
    const session = mediaSession();
    if (session === null || typeof session.setPositionState !== 'function') {
      return;
    }
    const now = Date.now();
    if (now - this.#positionPublishedAt < POSITION_UPDATE_MS) {
      return;
    }
    if (!Number.isFinite(durationSecs) || durationSecs <= 0) {
      return;
    }
    this.#positionPublishedAt = now;
    try {
      session.setPositionState({
        duration: durationSecs,
        playbackRate: 1,
        position: Math.min(positionSecs, durationSecs)
      });
    } catch {
      // The position state is advisory; a rejected one changes nothing.
    }
  }
}
