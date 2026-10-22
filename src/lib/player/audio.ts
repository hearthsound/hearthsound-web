/**
 * The element the player drives.
 *
 * The player never touches the browser's `Audio` type directly, so a test can
 * hand it a scripted stand-in and every method here has one caller-side
 * meaning.
 */

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
