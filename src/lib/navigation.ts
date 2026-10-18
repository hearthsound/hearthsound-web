/**
 * Navigation inside the client.
 *
 * The client is served from the origin root, so a client route is its own path;
 * resolving it only matters for a deployment that mounts the client under a base
 * path. SvelteKit types the paths a build knows about, and the routes of
 * features that land later are not part of those types yet, so a route travels
 * through {@link clientRoute} until the route exists.
 */
import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import type { PathnameWithSearchOrHash } from '$app/types';

/**
 * Names a route of the client for `resolve`.
 *
 * @param route The route, for example `/library/albums`.
 * @returns The route, as a path `resolve` accepts.
 */
export function clientRoute(route: string): PathnameWithSearchOrHash {
  return route as PathnameWithSearchOrHash;
}

/**
 * Sends the browser to a route of the client.
 *
 * @param route The route to open.
 * @param options `replaceState` replaces the current history entry instead of
 *   adding one.
 * @returns A promise that resolves once the navigation finished.
 */
export function navigate(route: string, options: { replaceState?: boolean } = {}): Promise<void> {
  return goto(resolve(clientRoute(route)), options);
}
