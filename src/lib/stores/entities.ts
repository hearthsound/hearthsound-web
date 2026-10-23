/**
 * What the pages already read, kept so the next page can draw before it asks.
 *
 * A grid of cards holds the very data its detail page opens with: the name, the
 * cover id and the counts the card drew. Without a seed the detail page has to
 * render a skeleton, wait for the server, and only then show the title of the
 * card the reader just clicked. This store is the handover: every list and
 * detail read records what it learned, and a detail page starts from the record
 * and replaces it when its own answer arrives.
 *
 * A seed is always partial and always disposable. It is merged over what was
 * stored before, so a summary recorded from a list keeps the tracks an earlier
 * detail read stored, and a detail read replaces the summary's fields. Nothing
 * reads a seed as the truth of a page: the page still asks the server.
 */
import type {
  AlbumID3,
  AlbumWithSongs,
  ArtistID3,
  ArtistWithAlbums,
  Playlist,
  PlaylistWithEntries
} from '#lib/subsonic/types';

/** An artist as a card or a detail page holds it. */
export type ArtistSeed = ArtistID3 | ArtistWithAlbums;

/** An album as a card or a detail page holds it. */
export type AlbumSeed = AlbumID3 | AlbumWithSongs;

/** A playlist as a row or a detail page holds it. */
export type PlaylistSeed = Playlist | PlaylistWithEntries;

/**
 * Merges one record over another.
 *
 * A key the newer record does not carry keeps the older value, which is what
 * makes a list's summary and a detail page's children combine instead of
 * replacing each other.
 *
 * @param stored The record already held, when there is one.
 * @param incoming The record just read.
 * @returns The merged record.
 */
function merge<T extends object>(stored: T | undefined, incoming: T): T {
  if (stored === undefined) {
    return incoming;
  }
  const merged = { ...stored } as Record<string, unknown>;
  for (const [key, value] of Object.entries(incoming)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged as T;
}

/** The seeds of the entities one session has read. */
export class EntitySeeds {
  /** Artists by client id. */
  readonly artists = new Map<string, ArtistSeed>();

  /** Albums by client id. */
  readonly albums = new Map<string, AlbumSeed>();

  /** Playlists by client id. */
  readonly playlists = new Map<string, PlaylistSeed>();

  /**
   * Records one artist.
   *
   * @param artist The artist, from a list or a detail read.
   */
  rememberArtist(artist: ArtistSeed): void {
    this.artists.set(artist.id, merge(this.artists.get(artist.id), artist));
  }

  /**
   * Records a list of artists.
   *
   * @param artists The artists a list read.
   */
  rememberArtists(artists: readonly ArtistSeed[]): void {
    for (const artist of artists) {
      this.rememberArtist(artist);
    }
  }

  /**
   * Records one album.
   *
   * @param album The album, from a list or a detail read.
   */
  rememberAlbum(album: AlbumSeed): void {
    this.albums.set(album.id, merge(this.albums.get(album.id), album));
  }

  /**
   * Records a list of albums.
   *
   * @param albums The albums a list read.
   */
  rememberAlbums(albums: readonly AlbumSeed[]): void {
    for (const album of albums) {
      this.rememberAlbum(album);
    }
  }

  /**
   * Records one playlist.
   *
   * @param playlist The playlist, from a row or a detail read.
   */
  rememberPlaylist(playlist: PlaylistSeed): void {
    this.playlists.set(playlist.id, merge(this.playlists.get(playlist.id), playlist));
  }

  /**
   * Records a list of playlists.
   *
   * @param playlists The playlists a list read.
   */
  rememberPlaylists(playlists: readonly PlaylistSeed[]): void {
    for (const playlist of playlists) {
      this.rememberPlaylist(playlist);
    }
  }

  /**
   * Returns what the session knows about one artist.
   *
   * @param id The artist's client id.
   * @returns The seed, or `undefined` when no read has seen the artist.
   */
  artist(id: string): ArtistSeed | undefined {
    return this.artists.get(id);
  }

  /**
   * Returns what the session knows about one album.
   *
   * @param id The album's client id.
   * @returns The seed, or `undefined` when no read has seen the album.
   */
  album(id: string): AlbumSeed | undefined {
    return this.albums.get(id);
  }

  /**
   * Returns what the session knows about one playlist.
   *
   * @param id The playlist's client id.
   * @returns The seed, or `undefined` when no read has seen the playlist.
   */
  playlist(id: string): PlaylistSeed | undefined {
    return this.playlists.get(id);
  }

  /** Forgets every seed, which is what signing out does. */
  clear(): void {
    this.artists.clear();
    this.albums.clear();
    this.playlists.clear();
  }
}

/** The seeds every page of the session reads. */
export const entities = new EntitySeeds();
