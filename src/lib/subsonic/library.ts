/**
 * The library calls the client makes against the server's `/rest` surface.
 *
 * Every call opts into the `hearthsound` vendor extension, so the entities an
 * answer carries report their availability, their place in the caller's
 * personal library and the caller's opinion of them. The two music folder ids
 * are the virtual folders the browse endpoints accept: folder `1` is the
 * caller's personal library and folder `2` is the server-wide view, which the
 * server may close through `privacy.server_browse`.
 *
 * The calls are also declared as interfaces, so a view or a store that only
 * needs one part of them - the membership writes, for example - can be handed
 * a fake in a test.
 */
import { subsonic } from './client';
import type {
  AlbumID3,
  AlbumList2Response,
  AlbumResponse,
  AlbumWithSongs,
  ArtistID3,
  ArtistResponse,
  ArtistsResponse,
  ArtistWithAlbums,
  Child,
  Playlist,
  PlaylistResponse,
  PlaylistsResponse,
  PlaylistWithEntries,
  Search3Response,
  Starred2,
  Starred2Response
} from './types';

/** The music folder id that selects the caller's personal library. */
export const PERSONAL_FOLDER = 1;

/** The music folder id that selects the server-wide view. */
export const SERVER_FOLDER = 2;

/** How many rows one page of a list holds. */
export const LIBRARY_PAGE_SIZE = 60;

/** The album order the album list asks for. */
const ALBUM_ORDER = 'alphabeticalByName';

/**
 * Reads one page of the tracks in scope.
 *
 * An empty query lists the scope instead of searching it, which is how the
 * server answers a browse, and the artist and album windows are asked for
 * nothing because the page wants tracks only.
 *
 * @param folder The music folder to read.
 * @param offset How many tracks to skip.
 * @param count How many tracks to answer with.
 * @returns The tracks of the page, in the server's order.
 */
export async function listSongs(folder: number, offset: number, count: number): Promise<Child[]> {
  const answer = await subsonic.get<Search3Response>('search3', {
    query: '',
    songCount: count,
    songOffset: offset,
    artistCount: 0,
    albumCount: 0,
    musicFolderId: folder
  });
  return answer.searchResult3?.song ?? [];
}

/**
 * Reads one page of the albums in scope.
 *
 * @param folder The music folder to read.
 * @param offset How many albums to skip.
 * @param count How many albums to answer with.
 * @returns The albums of the page, ordered by name.
 */
export async function listAlbums(
  folder: number,
  offset: number,
  count: number
): Promise<AlbumID3[]> {
  const answer = await subsonic.get<AlbumList2Response>('getAlbumList2', {
    type: ALBUM_ORDER,
    size: count,
    offset,
    musicFolderId: folder
  });
  return answer.albumList2?.album ?? [];
}

/**
 * Reads the artist index of a scope.
 *
 * The server groups the artists by index letter; the view renders one flat
 * list, so the groups are joined here.
 *
 * @param folder The music folder to read.
 * @returns Every artist of the scope.
 */
export async function listArtists(folder: number): Promise<ArtistID3[]> {
  const answer = await subsonic.get<ArtistsResponse>('getArtists', { musicFolderId: folder });
  const indexes = answer.artists?.index ?? [];
  return indexes.flatMap((index) => index.artist ?? []);
}

/**
 * Reads the entities the caller liked.
 *
 * @returns The liked tracks, albums and artists.
 */
export async function listStarred(): Promise<Starred2> {
  const answer = await subsonic.get<Starred2Response>('getStarred2');
  return answer.starred2 ?? {};
}

/**
 * Reads the playlists the caller may see.
 *
 * @returns The playlists, in the server's order.
 */
export async function listPlaylists(): Promise<Playlist[]> {
  const answer = await subsonic.get<PlaylistsResponse>('getPlaylists');
  return answer.playlists?.playlist ?? [];
}

/**
 * Reads one album with its tracks.
 *
 * @param id The album's client id.
 * @returns The album, or `null` when no such album is in scope.
 */
export async function loadAlbum(id: string): Promise<AlbumWithSongs | null> {
  const answer = await subsonic.get<AlbumResponse>('getAlbum', { id });
  return answer.album ?? null;
}

/**
 * Reads one artist with its albums.
 *
 * @param id The artist's client id.
 * @returns The artist, or `null` when no such artist is in scope.
 */
export async function loadArtist(id: string): Promise<ArtistWithAlbums | null> {
  const answer = await subsonic.get<ArtistResponse>('getArtist', { id });
  return answer.artist ?? null;
}

/**
 * Reads one playlist with its tracks.
 *
 * @param id The playlist's client id.
 * @returns The playlist, or `null` when the caller may not see it.
 */
export async function loadPlaylist(id: string): Promise<PlaylistWithEntries | null> {
  const answer = await subsonic.get<PlaylistResponse>('getPlaylist', { id });
  return answer.playlist ?? null;
}

/**
 * Adds entities to the caller's personal library.
 *
 * @param ids The client ids of the tracks, albums or artists to save.
 * @returns Nothing.
 */
export async function saveToLibrary(ids: readonly string[]): Promise<void> {
  await subsonic.post('hsSave', { id: [...ids] });
}

/**
 * Removes entities from the caller's personal library.
 *
 * @param ids The client ids of the tracks, albums or artists to remove.
 * @returns Nothing.
 */
export async function removeFromLibrary(ids: readonly string[]): Promise<void> {
  await subsonic.post('hsUnsave', { id: [...ids] });
}

/** The reads a library view makes. */
export interface BrowseApi {
  /**
   * Reads one page of the tracks in scope.
   *
   * @param folder The music folder to read.
   * @param offset How many tracks to skip.
   * @param count How many tracks to answer with.
   * @returns The tracks of the page.
   */
  songs(folder: number, offset: number, count: number): Promise<Child[]>;
  /**
   * Reads one page of the albums in scope.
   *
   * @param folder The music folder to read.
   * @param offset How many albums to skip.
   * @param count How many albums to answer with.
   * @returns The albums of the page.
   */
  albums(folder: number, offset: number, count: number): Promise<AlbumID3[]>;
  /**
   * Reads the artist index of a scope.
   *
   * @param folder The music folder to read.
   * @returns Every artist of the scope.
   */
  artists(folder: number): Promise<ArtistID3[]>;
  /**
   * Reads the entities the caller liked.
   *
   * @returns The liked tracks, albums and artists.
   */
  starred(): Promise<Starred2>;
  /**
   * Reads the playlists the caller may see.
   *
   * @returns The playlists.
   */
  playlists(): Promise<Playlist[]>;
  /**
   * Reads one album with its tracks.
   *
   * @param id The album's client id.
   * @returns The album, or `null` when it is not in scope.
   */
  album(id: string): Promise<AlbumWithSongs | null>;
  /**
   * Reads one artist with its albums.
   *
   * @param id The artist's client id.
   * @returns The artist, or `null` when it is not in scope.
   */
  artist(id: string): Promise<ArtistWithAlbums | null>;
  /**
   * Reads one playlist with its tracks.
   *
   * @param id The playlist's client id.
   * @returns The playlist, or `null` when the caller may not see it.
   */
  playlist(id: string): Promise<PlaylistWithEntries | null>;
}

/** The writes that change what the caller's personal library holds. */
export interface MembershipApi {
  /**
   * Adds entities to the personal library.
   *
   * @param ids The client ids to save.
   * @returns Nothing.
   */
  save(ids: readonly string[]): Promise<void>;
  /**
   * Removes entities from the personal library.
   *
   * @param ids The client ids to remove.
   * @returns Nothing.
   */
  unsave(ids: readonly string[]): Promise<void>;
}

/** Every library call, as the views and the stores make them. */
export type LibraryApi = BrowseApi & MembershipApi;

/** The library calls, made against the Subsonic surface. */
export const libraryApi: LibraryApi = {
  songs: listSongs,
  albums: listAlbums,
  artists: listArtists,
  starred: listStarred,
  playlists: listPlaylists,
  album: loadAlbum,
  artist: loadArtist,
  playlist: loadPlaylist,
  save: saveToLibrary,
  unsave: removeFromLibrary
};
