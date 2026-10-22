/**
 * The navigation context of the signed-in session.
 *
 * The sidebar and the views ask the same question of the session - who is
 * signed in, whether they administer the server and what the server offers -
 * so the object they answer with is built here once instead of at every call
 * site that tests an entry's visibility.
 */
import type { NavContext } from '#lib/nav';
import type { SessionStore } from '#lib/stores/session.svelte';

/**
 * Builds the navigation context of a session.
 *
 * @param session The signed-in session.
 * @returns The context a navigation rule tests.
 */
export function navContext(
  session: Pick<SessionStore, 'isAdmin' | 'systemInfo' | 'user'>
): NavContext {
  return {
    isAdmin: session.isAdmin,
    systemInfo: session.systemInfo,
    user: session.user
  };
}
