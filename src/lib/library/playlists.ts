/**
 * The rules the playlist views share.
 *
 * A playlist a client creates is permanent: it pins every track it holds, so
 * converting one to temporary is a separate statement about the caller's
 * library. The control that makes that statement says what it will do, and a
 * playlist that is temporary says so - with the instant it expires at, when the
 * server set one.
 */
import type { PlaylistLifetime } from '#lib/subsonic/types';

/** What the lifetime control of a playlist does and says. */
export interface LifetimeAction {
  /** The `temporary` value the control sends. */
  temporary: boolean;
  /** The text of the control. */
  label: string;
}

/**
 * Returns the action the lifetime control of a playlist performs.
 *
 * @param lifetime The playlist's lifetime, as the server reported it.
 * @returns The value the control sends and the words it shows.
 */
export function lifetimeAction(lifetime: { temporary: boolean }): LifetimeAction {
  return lifetime.temporary
    ? { temporary: false, label: 'Keep permanently' }
    : { temporary: true, label: 'Make temporary' };
}

/**
 * Returns the badge a playlist's lifetime shows.
 *
 * @param lifetime The playlist's vendor member, as the server reported it.
 * @returns The badge, or `null` for a permanent playlist.
 */
export function lifetimeBadge(lifetime: PlaylistLifetime | null | undefined): string | null {
  if (lifetime?.temporary !== true) {
    return null;
  }
  if (lifetime.expiresAt === undefined) {
    return 'Temporary';
  }
  return `Temporary until ${new Date(lifetime.expiresAt).toLocaleString()}`;
}
