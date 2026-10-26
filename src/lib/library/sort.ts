/**
 * The orders the library lists offer, and the address that keeps the choice.
 *
 * The list reads one of `getAlbumList2`'s orders through `listAlbumsBy`, and a
 * genre is one of those orders on the server (`byGenre`); the endpoint ignores
 * `genre` for every other type, so a genre and an order never combine into one
 * request. The choice therefore lives in the address: `?sort=` names the order
 * and `?genre=` names the genre, which is why a reload, a shared link and Back
 * all show what the reader chose.
 *
 * The song list asks the empty-query `search3` call for one of the six orders
 * the server reads from a `sort` parameter (title, added, played, artist, album
 * or year), and the artist index asks `getArtists` for one of the three
 * (name, added, played); the server ignores an order it does not know, so an
 * older server shows its own order rather than refusing the list.
 *
 * Everything here is pure. The view hands over the query string it is showing
 * and navigates to the route the helper builds; the menu compares the ids the
 * tables declare with the choice it was given.
 */
import type { AlbumListType } from '#lib/subsonic/library';

/** The id the address carries in `?sort=` for each order of the list. */
export type AlbumSortId =
  'name' | 'artist' | 'newest' | 'recent' | 'frequent' | 'highest' | 'starred' | 'random';

/** One order of the album list, as its menu item shows and names it. */
export interface AlbumSortOption {
  /** The id the address carries. */
  id: AlbumSortId;
  /** The visible label of the menu item. */
  label: string;
}

/** The order the album list shows when the address names none. */
export const DEFAULT_ALBUM_SORT: AlbumSortId = 'name';

/** The orders the album list offers, in the menu's order. */
export const ALBUM_SORTS: readonly AlbumSortOption[] = [
  { id: 'name', label: 'A-Z' },
  { id: 'artist', label: 'Artist A-Z' },
  { id: 'newest', label: 'Recently Added' },
  { id: 'recent', label: 'Recently Played' },
  { id: 'frequent', label: 'Most Played' },
  { id: 'highest', label: 'Rating' },
  { id: 'starred', label: 'Liked' },
  { id: 'random', label: 'Random' }
];

/** What the album list is showing: an order and, optionally, a genre. */
export interface AlbumQuery {
  /** The order the address names, or the default order. */
  sort: AlbumSortId;
  /** The genre the list is narrowed to, or `undefined` for the whole library. */
  genre: string | undefined;
}

/** The order each album order asks `getAlbumList2` for. */
const ALBUM_LIST_TYPES: Record<AlbumSortId, AlbumListType> = {
  name: 'alphabeticalByName',
  artist: 'alphabeticalByArtist',
  newest: 'newest',
  recent: 'recent',
  frequent: 'frequent',
  highest: 'highest',
  starred: 'starred',
  random: 'random'
};

/** The route of the album list, which every choice writes into the address. */
const ALBUMS_ROUTE = '/library/albums';

/**
 * Returns the `getAlbumList2` order an album order asks for.
 *
 * @param sort The album order the reader chose.
 * @returns The list type the endpoint takes.
 */
export function albumListType(sort: AlbumSortId): AlbumListType {
  return ALBUM_LIST_TYPES[sort];
}

/**
 * Returns the album order a `getAlbumList2` type is shown as.
 *
 * @param type The list type, as `listAlbumsBy` takes it.
 * @returns The album order, or `undefined` for a type the menu does not offer
 *   (`byYear`, `byGenre`).
 */
export function albumSortId(type: AlbumListType): AlbumSortId | undefined {
  return ALBUM_SORTS.find((option) => ALBUM_LIST_TYPES[option.id] === type)?.id;
}

/**
 * Reads the order and genre an address names.
 *
 * An unknown or absent `?sort=` falls back to the default order rather than
 * failing, so a hand-edited or stale address still shows a list; an empty
 * `?genre=` is no filter.
 *
 * @param search The query string, with or without its leading `?`.
 * @returns The query the list shows.
 */
export function readAlbumQuery(search: string): AlbumQuery {
  const params = new URLSearchParams(search);
  const requested = params.get('sort') ?? '';
  const genre = params.get('genre')?.trim() ?? '';
  return {
    sort: ALBUM_SORTS.find((option) => option.id === requested)?.id ?? DEFAULT_ALBUM_SORT,
    genre: genre === '' ? undefined : genre
  };
}

/**
 * Builds the address of the album list for a choice.
 *
 * The default order and an empty genre are left out, so the plain route stays
 * `/library/albums`.
 *
 * @param query The order and genre to show.
 * @returns The route, with its query string when the choice is not the default.
 */
export function albumRoute(query: AlbumQuery): string {
  const params = new URLSearchParams();
  if (query.sort !== DEFAULT_ALBUM_SORT) {
    params.set('sort', query.sort);
  }
  if (query.genre !== undefined && query.genre !== '') {
    params.set('genre', query.genre);
  }
  const search = params.toString();
  return search === '' ? ALBUMS_ROUTE : `${ALBUMS_ROUTE}?${search}`;
}

/**
 * Returns the order the album list reads a query with.
 *
 * A genre is a list order of its own on the server, so a genre in the address
 * means the list asks for `byGenre`; the order the address also carries applies
 * again once the genre is cleared.
 *
 * @param query The query the list shows.
 * @returns The list type to read.
 */
export function albumListTypeOf(query: AlbumQuery): AlbumListType {
  return query.genre === undefined ? albumListType(query.sort) : 'byGenre';
}

/**
 * Returns the extra parameters an album page read needs for a query.
 *
 * @param query The query the list shows.
 * @returns The genre to narrow to, or nothing for the whole library.
 */
export function albumNarrow(query: AlbumQuery): { genre?: string } {
  return query.genre === undefined ? {} : { genre: query.genre };
}

/** The id the address carries in `?sort=` for each order of the song list. */
export type SongSortId = 'title' | 'added' | 'played' | 'artist' | 'album' | 'year';

/** One order of the song list, as its menu item shows it. */
export interface SongSortOption {
  /** The id the address carries, and the token the server reads. */
  id: SongSortId;
  /** The visible label of the menu item. */
  label: string;
}

/** The order the song list shows when the address names none. */
export const DEFAULT_SONG_SORT: SongSortId = 'title';

/** The orders the song list offers, in the menu's order. */
export const SONG_SORTS: readonly SongSortOption[] = [
  { id: 'title', label: 'A-Z' },
  { id: 'artist', label: 'Artist A-Z' },
  { id: 'album', label: 'Album A-Z' },
  { id: 'added', label: 'Recently Added' },
  { id: 'played', label: 'Recently Played' },
  { id: 'year', label: 'Year' }
];

/** The route of the song list, which every choice writes into the address. */
const SONGS_ROUTE = '/library/songs';

/**
 * Reads the order a song list's address names.
 *
 * @param search The query string, with or without its leading `?`.
 * @returns The order the list shows.
 */
export function readSongQuery(search: string): SongSortId {
  const requested = new URLSearchParams(search).get('sort') ?? '';
  return SONG_SORTS.find((option) => option.id === requested)?.id ?? DEFAULT_SONG_SORT;
}

/**
 * Builds the address of the song list for one order.
 *
 * @param sort The order to show.
 * @returns The route, with its query string when the order is not the default.
 */
export function songRoute(sort: SongSortId): string {
  return sort === DEFAULT_SONG_SORT ? SONGS_ROUTE : `${SONGS_ROUTE}?sort=${sort}`;
}

/** The id the address carries in `?sort=` for each order of the artist index. */
export type ArtistSortId = 'name' | 'added' | 'played';

/** One order of the artist index, as its menu item shows it. */
export interface ArtistSortOption {
  /** The id the address carries, and the token the server reads. */
  id: ArtistSortId;
  /** The visible label of the menu item. */
  label: string;
}

/** The order the artist index shows when the address names none. */
export const DEFAULT_ARTIST_SORT: ArtistSortId = 'name';

/** The orders the artist index offers, in the menu's order. */
export const ARTIST_SORTS: readonly ArtistSortOption[] = [
  { id: 'name', label: 'A-Z' },
  { id: 'added', label: 'Recently Added' },
  { id: 'played', label: 'Most Played' }
];

/** The route of the artist index, which every choice writes into the address. */
const ARTISTS_ROUTE = '/library/artists';

/**
 * Reads the order an artist index's address names.
 *
 * @param search The query string, with or without its leading `?`.
 * @returns The order the index shows.
 */
export function readArtistQuery(search: string): ArtistSortId {
  const requested = new URLSearchParams(search).get('sort') ?? '';
  return ARTIST_SORTS.find((option) => option.id === requested)?.id ?? DEFAULT_ARTIST_SORT;
}

/**
 * Builds the address of the artist index for one order.
 *
 * @param sort The order to show.
 * @returns The route, with its query string when the order is not the default.
 */
export function artistRoute(sort: ArtistSortId): string {
  return sort === DEFAULT_ARTIST_SORT ? ARTISTS_ROUTE : `${ARTISTS_ROUTE}?sort=${sort}`;
}
