/**
 * The views the library renders and the heading of each one.
 *
 * The routes name their view in the URL (`/library/songs`, `/server/albums`),
 * so the set of names and the text they render are declared once here: a view
 * resolves the segment a route carries, and a route that carries something else
 * is answered with nothing to show instead of an empty list.
 */

/** The views a library route may name. */
export const LIBRARY_KINDS = [
  'songs',
  'albums',
  'artists',
  'liked',
  'playlists',
  'uploads'
] as const;

/** The view a library route names. */
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

/** The heading of each view. */
export const KIND_TITLES: Record<LibraryKind, string> = {
  songs: 'Songs',
  albums: 'Albums',
  artists: 'Artists',
  liked: 'Liked',
  playlists: 'Playlists',
  uploads: 'Uploads'
};

/**
 * Resolves the view a route segment names.
 *
 * @param value The route segment, as the URL carried it.
 * @returns The view, or `null` when the segment names none.
 */
export function libraryKind(value: string | undefined): LibraryKind | null {
  const kind = LIBRARY_KINDS.find((candidate) => candidate === value);
  return kind ?? null;
}
