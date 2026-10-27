/**
 * The links to an artist's and an album's pages.
 *
 * An entity has one id and one URL: `/artist/<id>`, `/album/<id>` and
 * `/artist/<id>/top-songs`. The id is the row id every surface names, so a
 * link never resolves a readable name and never carries a second identity
 * beside the one the server answered with.
 */

/**
 * Builds an artist's page path.
 *
 * @param id The artist's client id (`ar_...`).
 * @returns The route.
 */
export function artistHref(id: string): string {
  return `/artist/${encodeURIComponent(id)}`;
}

/**
 * Builds an album's page path.
 *
 * @param id The album's client id (`al_...`).
 * @returns The route.
 */
export function albumHref(id: string): string {
  return `/album/${encodeURIComponent(id)}`;
}

/**
 * Builds the path of an artist's complete top songs list.
 *
 * @param id The artist's client id (`ar_...`).
 * @returns The route.
 */
export function topSongsHref(id: string): string {
  return `${artistHref(id)}/top-songs`;
}
