/**
 * The library calls the client makes against the server's `/rest` surface.
 *
 * Every call opts into the `hearthsound` vendor extension, so the entities an
 * answer carries report their availability, their place in the caller's
 * personal library and the caller's opinion of them. The music folder ids the
 * browse endpoints accept are virtual: folder `1` is the caller's personal
 * library, and folder `2` is the server-wide view, which only an administrator
 * may read.
 *
 * The calls are also declared as interfaces, so a view or a store that only
 * needs one part of them - the membership writes, for example - can be handed
 * a fake in a test.
 */
import { entities } from '#lib/stores/entities';

import { isNotFound, subsonic } from './client';
import type {
  AlbumID3,
  AlbumList2Response,
  AlbumResponse,
  AlbumWithSongs,
  ArtistID3,
  ArtistResponse,
  ArtistsResponse,
  ArtistInfo,
  ArtistInfo2Response,
  ArtistWithAlbums,
  Child,
  FeedbackValue,
  LibraryCounts,
  LibraryCountsResponse,
  Playlist,
  PlaylistResponse,
  PlaylistsResponse,
  PlaylistWithEntries,
  RandomSongsResponse,
  Search3Response,
  Starred2,
  Starred2Response,
  TopSongsResponse
} from './types';

/** The music folder id that selects the caller's personal library. */
export const PERSONAL_FOLDER = 1;

/** How many rows one page of a list holds. */
export const LIBRARY_PAGE_SIZE = 60;

/** The album order the album list asks for. */
const ALBUM_ORDER = 'alphabeticalByName';

/** The album orders `getAlbumList2` takes. */
export type AlbumListType =
  | 'random'
  | 'newest'
  | 'frequent'
  | 'recent'
  | 'highest'
  | 'alphabeticalByName'
  | 'alphabeticalByArtist'
  | 'starred'
  | 'byYear'
  | 'byGenre';

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
  const albums = answer.albumList2?.album ?? [];
  entities.rememberAlbums(albums);
  return albums;
}

/**
 * Reads one page of the albums in scope, in one of the list orders
 * `getAlbumList2` takes.
 *
 * @param type The order the list asks for.
 * @param folder The music folder to read.
 * @param offset How many albums to skip.
 * @param count How many albums to answer with.
 * @returns The albums of the page.
 */
export async function listAlbumsBy(
  type: AlbumListType,
  folder: number,
  offset: number,
  count: number
): Promise<AlbumID3[]> {
  const answer = await subsonic.get<AlbumList2Response>('getAlbumList2', {
    type,
    size: count,
    offset,
    musicFolderId: folder
  });
  const albums = answer.albumList2?.album ?? [];
  entities.rememberAlbums(albums);
  return albums;
}

/**
 * Reads a handful of random tracks from a scope.
 *
 * The endpoint has no cursor: every call draws a new set, so a view asks once
 * for the whole list it shows.
 *
 * @param folder The music folder to read.
 * @param count How many tracks to ask for.
 * @returns The tracks, in the order the server drew them.
 */
export async function listRandomSongs(folder: number, count: number): Promise<Child[]> {
  const answer = await subsonic.get<RandomSongsResponse>('getRandomSongs', {
    size: count,
    musicFolderId: folder
  });
  return answer.randomSongs?.song ?? [];
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
  const artists = indexes.flatMap((index) => index.artist ?? []);
  entities.rememberArtists(artists);
  return artists;
}

/**
 * Reads the entities the caller liked.
 *
 * @returns The liked tracks, albums and artists.
 */
export async function listStarred(): Promise<Starred2> {
  const answer = await subsonic.get<Starred2Response>('getStarred2');
  const starred = answer.starred2 ?? {};
  entities.rememberArtists(starred.artist ?? []);
  entities.rememberAlbums(starred.album ?? []);
  return starred;
}

/**
 * Reads the playlists the caller may see.
 *
 * @returns The playlists, in the server's order.
 */
export async function listPlaylists(): Promise<Playlist[]> {
  const answer = await subsonic.get<PlaylistsResponse>('getPlaylists');
  const playlists = answer.playlists?.playlist ?? [];
  entities.rememberPlaylists(playlists);
  return playlists;
}

/**
 * Reads one album with its tracks.
 *
 * @param id The album's client id.
 * @returns The album, or `null` when no such album is in scope.
 */
export async function loadAlbum(id: string): Promise<AlbumWithSongs | null> {
  try {
    const answer = await subsonic.get<AlbumResponse>('getAlbum', { id });
    if (answer.album !== undefined) {
      entities.rememberAlbum(answer.album);
    }
    return answer.album ?? null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Reads one artist with its albums.
 *
 * @param id The artist's client id.
 * @returns The artist, or `null` when no such artist is in scope.
 */
export async function loadArtist(id: string): Promise<ArtistWithAlbums | null> {
  try {
    const answer = await subsonic.get<ArtistResponse>('getArtist', { id });
    if (answer.artist !== undefined) {
      entities.rememberArtist(answer.artist);
      entities.rememberAlbums(answer.artist.album ?? []);
    }
    return answer.artist ?? null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Reads an artist's biography.
 *
 * @param id The artist's client id.
 * @returns The biography, or `null` when the server knows none.
 */
export async function loadArtistInfo(id: string): Promise<ArtistInfo | null> {
  const answer = await subsonic.get<ArtistInfo2Response>('getArtistInfo2', { id });
  const biography = answer.artistInfo2?.biography;
  return biography === undefined ? null : (answer.artistInfo2 ?? null);
}

/**
 * Reads an artist's most played tracks.
 *
 * @param id The artist's client id.
 * @param count How many tracks to ask for; the server caps the answer.
 * @returns The tracks, most played first.
 */
export async function listTopSongs(id: string, count: number): Promise<Child[]> {
  const answer = await subsonic.get<TopSongsResponse>('getTopSongs', { id, count });
  return answer.topSongs?.song ?? [];
}

/**
 * Reads one playlist with its tracks.
 *
 * @param id The playlist's client id.
 * @returns The playlist, or `null` when the caller may not see it.
 */
export async function loadPlaylist(id: string): Promise<PlaylistWithEntries | null> {
  try {
    const answer = await subsonic.get<PlaylistResponse>('getPlaylist', { id });
    if (answer.playlist !== undefined) {
      entities.rememberPlaylist(answer.playlist);
    }
    return answer.playlist ?? null;
  } catch (error) {
    if (isNotFound(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Reads how many items each list of the library holds.
 *
 * The standard lists carry no total, so a view cannot know how many rows a page
 * of placeholders stands for; this is the count that sizes them.
 *
 * @param folder The music folder to read.
 * @returns The counts of the scope, and of the caller's own likes, playlists
 * and uploads.
 */
export async function loadLibraryCounts(folder: number): Promise<LibraryCounts> {
  const answer = await subsonic.get<LibraryCountsResponse>('hsGetLibraryCounts', {
    musicFolderId: folder
  });
  const counts = answer.libraryCounts;
  return {
    artists: counts?.artists ?? 0,
    albums: counts?.albums ?? 0,
    songs: counts?.songs ?? 0,
    playlists: counts?.playlists ?? 0,
    likedArtists: counts?.likedArtists ?? 0,
    likedAlbums: counts?.likedAlbums ?? 0,
    likedSongs: counts?.likedSongs ?? 0,
    uploads: counts?.uploads ?? 0
  };
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

/**
 * Records the caller's opinion of entities.
 *
 * A like replaces a dislike and the other way round, and clearing takes
 * whichever the caller held.
 *
 * @param ids The client ids of the entities to write.
 * @param value The opinion to record.
 * @returns Nothing.
 */
export async function setFeedback(ids: readonly string[], value: FeedbackValue): Promise<void> {
  await subsonic.post('hsSetFeedback', { id: [...ids], value });
}

/**
 * Records the caller's rating of one entity.
 *
 * @param id The entity's client id.
 * @param rating The rating from 1 to 5, or 0 to clear it.
 * @returns Nothing.
 */
export async function setRating(id: string, rating: number): Promise<void> {
  await subsonic.post('setRating', { id, rating });
}

/**
 * Creates a playlist, or replaces the tracks of an owned one.
 *
 * A playlist a client creates is permanent, which is what the caller's own
 * tracks are pinned by; converting it to temporary is a second call.
 *
 * @param name The playlist's name.
 * @param songIds The tracks to start the playlist with, when there are any.
 * @returns The playlist that was created.
 */
export async function createPlaylist(
  name: string,
  songIds: readonly string[] = []
): Promise<Playlist | null> {
  const answer = await subsonic.post<PlaylistResponse>('createPlaylist', {
    name,
    songId: [...songIds]
  });
  return answer.playlist ?? null;
}

/**
 * Changes one owned playlist.
 *
 * @param id The playlist's client id.
 * @param update The fields to change and the tracks to add or remove.
 * @returns Nothing.
 */
export async function updatePlaylist(id: string, update: PlaylistUpdate): Promise<void> {
  await subsonic.post('updatePlaylist', {
    playlistId: id,
    name: update.name,
    songIdToAdd: update.add === undefined ? undefined : [...update.add],
    songIndexToRemove: update.remove === undefined ? undefined : [...update.remove]
  });
}

/**
 * Deletes one owned playlist.
 *
 * @param id The playlist's client id.
 * @returns Nothing.
 */
export async function deletePlaylist(id: string): Promise<void> {
  await subsonic.post('deletePlaylist', { id });
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
   * Reads one page of the albums in scope, in a `getAlbumList2` order.
   *
   * @param type The order to read.
   * @param folder The music folder to read.
   * @param offset How many albums to skip.
   * @param count How many albums to answer with.
   * @returns The albums of the page.
   */
  albumsBy(type: AlbumListType, folder: number, offset: number, count: number): Promise<AlbumID3[]>;
  /**
   * Reads random tracks from a scope.
   *
   * @param folder The music folder to read.
   * @param count How many tracks to ask for.
   * @returns The drawn tracks.
   */
  randomSongs(folder: number, count: number): Promise<Child[]>;
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
   * Reads an artist's biography.
   *
   * @param id The artist's client id.
   * @returns The biography, or `null` when the server knows none.
   */
  artistInfo(id: string): Promise<ArtistInfo | null>;
  /**
   * Reads an artist's most played tracks.
   *
   * @param id The artist's client id.
   * @param count How many tracks to ask for.
   * @returns The tracks, most played first.
   */
  topSongs(id: string, count: number): Promise<Child[]>;
  /**
   * Reads one playlist with its tracks.
   *
   * @param id The playlist's client id.
   * @returns The playlist, or `null` when the caller may not see it.
   */
  playlist(id: string): Promise<PlaylistWithEntries | null>;
  /**
   * Reads how many items each list of the library holds.
   *
   * @param folder The music folder to read.
   * @returns The counts of the scope and of the caller's own lists.
   */
  counts(folder: number): Promise<LibraryCounts>;
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

/** The writes that record the caller's opinion of an entity. */
export interface FeedbackApi {
  /**
   * Records the caller's opinion of entities.
   *
   * @param ids The client ids to write.
   * @param value The opinion to record.
   * @returns Nothing.
   */
  setFeedback(ids: readonly string[], value: FeedbackValue): Promise<void>;
  /**
   * Records the caller's rating of one entity.
   *
   * @param id The entity's client id.
   * @param rating The rating from 1 to 5, or 0 to clear it.
   * @returns Nothing.
   */
  setRating(id: string, rating: number): Promise<void>;
}

/** The change one `updatePlaylist` call makes. */
export interface PlaylistUpdate {
  /** A new name for the playlist. */
  name?: string;
  /** The tracks to add, in order. */
  add?: readonly string[];
  /** The indexes of the tracks to remove, in order. */
  remove?: readonly number[];
}

/** The writes that change a playlist. */
export interface PlaylistApi {
  /**
   * Creates a playlist.
   *
   * @param name The playlist's name.
   * @param songIds The tracks to start it with.
   * @returns The playlist that was created.
   */
  createPlaylist(name: string, songIds?: readonly string[]): Promise<Playlist | null>;
  /**
   * Changes one owned playlist.
   *
   * @param id The playlist's client id.
   * @param update The change to make.
   * @returns Nothing.
   */
  updatePlaylist(id: string, update: PlaylistUpdate): Promise<void>;
  /**
   * Deletes one owned playlist.
   *
   * @param id The playlist's client id.
   * @returns Nothing.
   */
  deletePlaylist(id: string): Promise<void>;
}

/** Every library call, as the views and the stores make them. */
export type LibraryApi = BrowseApi & MembershipApi & FeedbackApi & PlaylistApi;

/** The library calls, made against the Subsonic surface. */
export const libraryApi: LibraryApi = {
  songs: listSongs,
  albums: listAlbums,
  albumsBy: listAlbumsBy,
  randomSongs: listRandomSongs,
  artists: listArtists,
  starred: listStarred,
  playlists: listPlaylists,
  album: loadAlbum,
  artist: loadArtist,
  artistInfo: loadArtistInfo,
  topSongs: listTopSongs,
  playlist: loadPlaylist,
  counts: loadLibraryCounts,
  save: saveToLibrary,
  unsave: removeFromLibrary,
  setFeedback,
  setRating,
  createPlaylist,
  updatePlaylist,
  deletePlaylist
};
