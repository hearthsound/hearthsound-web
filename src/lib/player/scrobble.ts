/**
 * When a play counts.
 *
 * The server records a play once the listener heard enough of it: half the
 * track, or four minutes for anything longer, so a three-hour mix is not
 * recorded four times over. A track of unknown length is held to the floor.
 */

/** The position at which a play is reported, in seconds. */
export const SCROBBLE_FLOOR_SECS = 240;

/**
 * How often one play is sent before it is dropped.
 *
 * A submission that fails is kept and sent again on the next submission and
 * when the browser is back online; three attempts covers a short outage without
 * keeping a play that will never land.
 */
export const SCROBBLE_ATTEMPTS = 3;

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
