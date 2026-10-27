/**
 * The native entity pages: artists, albums, tracks and search.
 *
 * Every call reads what the server stored for one entity and hands the page the
 * shapes the native API documents. The types below mirror
 * `crates/api-native` until the generated schema carries these paths; once
 * `npm run api:sync` has run against a core that publishes them, the shapes
 * here can be replaced by `components` from `#lib/api/schema` and the cast to
 * `Client<EntityPaths>` removed.
 *
 * A page that names no stored entity answers `null`; every other failure is
 * thrown, so a page tells "not found" from "the server did not answer".
 */
import type { Client } from 'openapi-fetch';

import { nativeClient } from '#lib/api/native';
import type { Song } from '#lib/library/song';
import type { Availability } from '#lib/subsonic/types';

/** One artist as a credit or a list names it. */
export interface ArtistRef {
  /** The artist's client id (`ar_...`). */
  id: string;
  /** The display name. */
  name: string;
}

/** One external page an artist is linked from. */
export interface LinkView {
  /** The kind of page, for example `wikipedia` or `homepage`. */
  kind: string;
  /** The page's URL. */
  url: string;
}

/** One artist in a shelf or a result list. */
export interface ArtistSummary {
  /** The artist's client id (`ar_...`). */
  id: string;
  /** The display name. */
  name: string;
  /** Whether the server holds a portrait. */
  hasImage: boolean;
  /** Whether the caller's personal library holds the artist. */
  inLibrary: boolean;
  /** How well the artist matches a search query, when the answer scores it. */
  score?: number;
}

/** One album in a shelf or a result list. */
export interface AlbumSummary {
  /** The album's client id (`al_...`). */
  id: string;
  /** The album's title. */
  title: string;
  /** The edition label, or `null` when the release states none. */
  edition: string | null;
  /** The release year, or `null` when unknown. */
  year: number | null;
  /** The release type: `album`, `ep`, `single` or a secondary type. */
  albumType: string | null;
  /** The album artist as it is displayed. */
  displayArtist: string | null;
  /** The primary credited artist's client id. */
  artistId: string | null;
  /** Whether the server holds a cover. */
  hasImage: boolean;
  /** Whether the caller's personal library holds the album. */
  inLibrary: boolean;
  /** How well the album matches a search query, when the answer scores it. */
  score?: number;
}

/** One track, as a page, a shelf or a result list names it. */
export interface TrackSummary {
  /** The track's client id (`tr_...`). */
  id: string;
  /** The title. */
  title: string;
  /** The credited artists, in order. */
  artists: ArtistRef[];
  /** The album's client id, or `null` when the track has no album. */
  albumId: string | null;
  /** The album's title, or `null` when the track has no album. */
  albumTitle: string | null;
  /** The disc number within the release. */
  discNumber: number | null;
  /** The track number within its disc. */
  trackNumber: number | null;
  /** The track's length in milliseconds. */
  durationMs: number | null;
  /** Whether the track is explicit, when the tags say. */
  explicit: boolean | null;
  /** The track's availability. */
  availability: Availability;
  /** Whether the caller's personal library holds the track. */
  inLibrary: boolean;
  /** Whether the caller likes the track. */
  liked: boolean;
  /** Whether the caller dislikes the track. */
  disliked: boolean;
  /** The caller's rating, from 1 to 5. */
  rating: number | null;
  /** Whether the server holds a cover for the track or its album. */
  hasImage: boolean;
  /** How well the track matches a search query, when the answer scores it. */
  score?: number;
}

/** One artist's page. */
export interface ArtistPage {
  /** The artist's client id (`ar_...`). */
  id: string;
  /** The display name. */
  name: string;
  /** The ordering key derived from the name. */
  sortName: string;
  /** The stored biography, when a provider stated one. */
  biography: string | null;
  /** The external pages the artist is linked from. */
  links: LinkView[];
  /** Whether the server holds a portrait. */
  hasImage: boolean;
  /** Whether the caller's personal library holds the artist. */
  inLibrary: boolean;
  /** Whether the caller likes the artist. */
  liked: boolean;
  /** Whether the caller dislikes the artist. */
  disliked: boolean;
  /** The caller's rating, from 1 to 5. */
  rating: number | null;
  /** The artist's most popular tracks, at most five. */
  topTracks: TrackSummary[];
  /** The discography, one album per release group, newest first. */
  albums: AlbumSummary[];
  /** Similar artists, at most twelve. */
  similarArtists: ArtistSummary[];
  /** Whether the stored data covers the page. */
  complete: boolean;
}

/** One album's page. */
export interface AlbumPage {
  /** The album's client id (`al_...`). */
  id: string;
  /** The title. */
  title: string;
  /** The edition label, or `null` when the release states none. */
  edition: string | null;
  /** The album artist as it is displayed. */
  displayArtist: string | null;
  /** The credited artists, in order. */
  artists: ArtistRef[];
  /** The release date as the provider stated it, or `null`. */
  releaseDate: string | null;
  /** The release year, or `null` when unknown. */
  year: number | null;
  /** The release type. */
  albumType: string | null;
  /** The album's genres. */
  genres: string[];
  /** How many tracks the release holds. */
  trackCount: number | null;
  /** How long the album plays, in milliseconds. */
  durationMs: number | null;
  /** Whether the server holds a cover. */
  hasImage: boolean;
  /** Whether the caller's personal library holds the album. */
  inLibrary: boolean;
  /** Whether the caller likes the album. */
  liked: boolean;
  /** Whether the caller dislikes the album. */
  disliked: boolean;
  /** The caller's rating, from 1 to 5. */
  rating: number | null;
  /** The album's tracks, in disc and track order. */
  tracks: TrackSummary[];
  /** Other albums by the primary artist, at most twelve. */
  moreByArtist: AlbumSummary[];
  /** Whether the stored data covers the page. */
  complete: boolean;
}

/** One artist's top tracks. */
export interface TopTracksView {
  /** The tracks, most popular first. */
  tracks: TrackSummary[];
}

/** The kinds a search may narrow to. */
export type SearchKind = 'artists' | 'albums' | 'tracks';

/** One search's answer. */
export interface SearchView {
  /** Matching artists, best first. */
  artists: ArtistSummary[];
  /** Matching albums, best first. */
  albums: AlbumSummary[];
  /** Matching tracks, best first. */
  tracks: TrackSummary[];
  /** The continuation of the one kind the request narrowed to, or `null`. */
  nextCursor: string | null;
}

/** How the entity index queue stands. */
export interface IndexStatus {
  /** How many entities are waiting to be indexed. */
  pending: number;
  /** How many entities failed their last pass and wait for a retry. */
  failed: number;
  /** How many entities this process has indexed. */
  done: number;
  /** How many entities this process has claimed. */
  total: number;
}

/** A refused request, as the server words it. */
export interface ProblemBody {
  /** A URI that names the problem type. */
  type?: string;
  /** A short summary. */
  title?: string;
  /** The HTTP status. */
  status?: number;
  /** The sentence the views show. */
  detail?: string;
  /** A machine-readable code. */
  code?: string;
}

/** A JSON answer. */
interface JsonBody<T> {
  headers: Record<string, unknown>;
  content: { 'application/json': T };
}

/** A problem answer. */
interface ProblemResponse {
  headers: Record<string, unknown>;
  content: { 'application/problem+json': ProblemBody };
}

/** The query and path parameters the client sends. */
interface EntityQuery {
  query?: never;
  header?: never;
  path?: never;
  cookie?: never;
}

/** One entity page path, as the generated schema spells it. */
interface PagePath<Parameters, Result> {
  parameters: EntityQuery;
  get: {
    parameters: Parameters;
    requestBody?: never;
    responses: {
      200: JsonBody<Result>;
      401: ProblemResponse;
      404: ProblemResponse;
    };
  };
  put?: never;
  post?: never;
  delete?: never;
  options?: never;
  head?: never;
  patch?: never;
  trace?: never;
}

/** The paths of the entity pages, until the generated schema carries them. */
interface EntityPaths {
  '/api/v1/artists/{id}': PagePath<
    { path: { id: string }; query?: never; header?: never; cookie?: never },
    ArtistPage
  >;
  '/api/v1/artists/{id}/top-tracks': PagePath<
    { path: { id: string }; query?: { limit?: number }; header?: never; cookie?: never },
    TopTracksView
  >;
  '/api/v1/albums/{id}': PagePath<
    { path: { id: string }; query?: never; header?: never; cookie?: never },
    AlbumPage
  >;
  '/api/v1/tracks/{id}': PagePath<
    { path: { id: string }; query?: never; header?: never; cookie?: never },
    TrackSummary
  >;
  '/api/v1/search': {
    parameters: EntityQuery;
    get: {
      parameters: {
        query: { q: string; kinds?: string; limit?: number; cursor?: string };
        header?: never;
        path?: never;
        cookie?: never;
      };
      requestBody?: never;
      responses: { 200: JsonBody<SearchView>; 401: ProblemResponse };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/index': {
    parameters: EntityQuery;
    get: {
      parameters: { query?: never; header?: never; path?: never; cookie?: never };
      requestBody?: never;
      responses: { 200: JsonBody<IndexStatus>; 401: ProblemResponse; 403: ProblemResponse };
    };
    put?: never;
    post?: never;
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
  '/api/v1/admin/entities/{id}/refresh': {
    parameters: EntityQuery;
    get?: never;
    put?: never;
    post: {
      parameters: { path: { id: string }; query?: never; header?: never; cookie?: never };
      requestBody?: never;
      responses: {
        202: JsonBody<{ queued: boolean }>;
        401: ProblemResponse;
        403: ProblemResponse;
        404: ProblemResponse;
      };
    };
    delete?: never;
    options?: never;
    head?: never;
    patch?: never;
    trace?: never;
  };
}

/** The native client, typed with the entity paths the schema does not carry yet. */
const client = nativeClient as unknown as Client<EntityPaths>;

/**
 * Returns the sentence a refused call shows.
 *
 * @param problem The problem the server answered, when it answered one.
 * @param fallback The sentence to show when it did not.
 * @returns The message.
 */
function messageOf(problem: ProblemBody | undefined, fallback: string): string {
  return problem?.detail ?? problem?.title ?? fallback;
}

/**
 * Reads one artist's page.
 *
 * @param id The artist's client id.
 * @returns The page, or `null` when no artist with that id is stored.
 */
export async function loadArtist(id: string): Promise<ArtistPage | null> {
  const answer = await client.GET('/api/v1/artists/{id}', { params: { path: { id } } });
  if (answer.data !== undefined) {
    return answer.data;
  }
  if (answer.response.status === 404) {
    return null;
  }
  throw new Error(messageOf(answer.error, 'Could not load this artist.'));
}

/**
 * Reads one artist's top tracks.
 *
 * @param id The artist's client id.
 * @param limit How many tracks to return, from 1 to 100.
 * @returns The tracks, most popular first.
 */
export async function loadTopTracks(id: string, limit = 100): Promise<TrackSummary[]> {
  const answer = await client.GET('/api/v1/artists/{id}/top-tracks', {
    params: { path: { id }, query: { limit } }
  });
  if (answer.data !== undefined) {
    return answer.data.tracks;
  }
  if (answer.response.status === 404) {
    return [];
  }
  throw new Error(messageOf(answer.error, 'Could not load this artist\u2019s top songs.'));
}

/**
 * Reads one album's page.
 *
 * @param id The album's client id.
 * @returns The page, or `null` when no album with that id is stored.
 */
export async function loadAlbum(id: string): Promise<AlbumPage | null> {
  const answer = await client.GET('/api/v1/albums/{id}', { params: { path: { id } } });
  if (answer.data !== undefined) {
    return answer.data;
  }
  if (answer.response.status === 404) {
    return null;
  }
  throw new Error(messageOf(answer.error, 'Could not load this album.'));
}

/**
 * Options of a search.
 */
export interface SearchOptions {
  /** The kinds to return; every kind when absent. */
  kinds?: SearchKind[];
  /** The most hits per kind, from 1 to 60. */
  limit?: number;
  /** The continuation of the one kind the request narrowed to. */
  cursor?: string | null;
}

/**
 * Searches the caller's library and the catalog.
 *
 * @param text The text to search for.
 * @param options The kinds, the per-kind limit and the cursor.
 * @returns Each kind's hits, best first.
 */
export async function search(text: string, options: SearchOptions = {}): Promise<SearchView> {
  const answer = await client.GET('/api/v1/search', {
    params: {
      query: {
        q: text,
        ...(options.kinds === undefined ? {} : { kinds: options.kinds.join(',') }),
        ...(options.limit === undefined ? {} : { limit: options.limit }),
        ...(options.cursor === undefined || options.cursor === null
          ? {}
          : { cursor: options.cursor })
      }
    }
  });
  if (answer.data !== undefined) {
    return answer.data;
  }
  throw new Error(messageOf(answer.error, 'Could not run the search.'));
}

/**
 * Reads the entity index queue.
 *
 * @returns What is queued, what failed and what this process has done.
 */
export async function loadIndexStatus(): Promise<IndexStatus> {
  const answer = await client.GET('/api/v1/admin/index');
  if (answer.data !== undefined) {
    return answer.data;
  }
  throw new Error(messageOf(answer.error, 'Could not read the index queue.'));
}

/**
 * Queues one entity for a metadata refresh.
 *
 * @param id The entity's client id.
 * @returns Nothing, once the server queued it.
 */
export async function refreshEntity(id: string): Promise<void> {
  const answer = await client.POST('/api/v1/admin/entities/{id}/refresh', {
    params: { path: { id } }
  });
  if (answer.data !== undefined) {
    return;
  }
  throw new Error(messageOf(answer.error, 'Could not refresh this entity.'));
}

/**
 * Converts a native track into the row a song list draws.
 *
 * @param track The track.
 * @returns The row.
 */
export function songOf(track: TrackSummary): Song {
  return {
    id: track.id,
    title: track.title,
    artist: track.artists.map((artist) => artist.name).join(', '),
    album: track.albumTitle ?? undefined,
    albumId: track.albumId ?? undefined,
    artistId: track.artists[0]?.id,
    duration: track.durationMs === null ? undefined : track.durationMs / 1000,
    coverArt: track.hasImage ? track.id : undefined,
    track: track.trackNumber ?? undefined,
    liked: track.liked,
    disliked: track.disliked,
    inLibrary: track.inLibrary,
    userRating: track.rating ?? undefined
  };
}
