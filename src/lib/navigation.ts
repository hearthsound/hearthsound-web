/**
 * Navigation inside the client.
 *
 * The client is served from the origin root, so a client route is its own path;
 * resolving it is what puts the deployment's base path in front of a route, and
 * that is what every link and every `goto` here goes through. SvelteKit types
 * `resolve` against the routes a build can enumerate, which it spells as paths
 * without the leading slash, and a route this client assembles at runtime -
 * `/playlist/<id>` from a route parameter, or a link from the navigation data -
 * is not one of those. The leading slash therefore comes off in one place,
 * {@link clientRoute}, so the views keep writing the route they want to visit
 * and no view needs a cast of its own.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { Path } from '$app/types';

/**
 * Names a route of the client for `resolve`.
 *
 * @param route The route, for example `/library/albums`.
 * @returns The route as `resolve` takes it: the path it names.
 */
export function clientRoute(route: string): Path {
  return (route.startsWith('/') ? route.slice(1) : route) as Path;
}

/**
 * Sends the browser to a route of the client.
 *
 * @param route The route to open.
 * @param options `replace` replaces the current history entry instead of
 *   adding one; `reset: false` leaves scroll and focus where they are instead
 *   of blurring the focused element and moving focus to the document, which a
 *   field that navigates while the user types needs (SvelteKit 3 replaced
 *   `replaceState` and `keepFocus` with these two).
 * @returns A promise that resolves once the navigation finished.
 */
export function navigate(
  route: string,
  options?: { replace?: boolean; reset?: boolean }
): Promise<void> {
  return goto(resolve(clientRoute(route)), options);
}

/**
 * Returns to the page before this one, or opens a fallback route.
 *
 * A page opened from a shared link or a direct visit has no page to return to,
 * so it goes to the list it belongs under instead of leaving the client.
 *
 * @param fallback The route to open when there is no page to return to.
 * @returns Nothing.
 */
export function goBack(fallback: string): void {
  if (window.history.length > 1) {
    window.history.back();
  } else {
    void navigate(fallback);
  }
}
