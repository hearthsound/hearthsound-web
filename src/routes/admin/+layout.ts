/**
 * The administration guard.
 *
 * An account that does not administer the server never sees these routes: the
 * load raises the p27 Forbidden status (403) before the area renders, which the
 * root error page draws inside the shell. A route opened by hand therefore
 * answers the same as the navigation, which does not offer it, but explains why
 * instead of silently dropping the browser on Home.
 *
 * The guard waits for the session's boot sequence, because the first visit to
 * an administration address runs before the shell mounts. The boot sequence is
 * shared with the shell, so this costs no extra request. A browser without a
 * session is left to the shell, which sends it to the sign-in form and
 * remembers the route.
 */
import { error } from '@sveltejs/kit';

import { session } from '#lib/stores/session.svelte';

/**
 * Refuses the administration area to a signed-in member.
 *
 * @returns Nothing; the route's own component needs no data.
 */
export async function load(): Promise<Record<string, never>> {
  await session.boot();
  if (session.user !== null && !session.isAdmin) {
    error(403, 'Not Allowed');
  }
  return {};
}
