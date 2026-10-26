/**
 * Wire types of the server's Subsonic `/rest` surface.
 *
 * Only the members the client reads are declared. Every non-binary answer
 * wraps its payload in the standard Subsonic envelope, and the entities carry
 * the `hearthsound` vendor member because the client sends `hearthsound=1` on
 * every call. The state literals (`local`, `downloading`, `queued`, ...) are
 * the ones the server stores and publishes, so they are repeated here exactly.
 */

/** One of the five availability states of a track, album or artist. */
export type Availability = 'local' | 'cached' | 'acquiring' | 'remote' | 'unavailable';

/** The state of an acquisition in the server's acquisition state machine. */
export type AcquisitionState =
  | 'queued'
  | 'resolving'
  | 'searching'
  | 'downloading'
  | 'verifying'
  | 'importing'
  | 'completed'
  | 'failed'
  | 'cancelled';

/** Why an acquisition is waiting for a download source (UR1). */
export type ParkReason = 'no-source' | 'source-unavailable';

/** The scheduling priority of an acquisition, most urgent first. */
export type Priority = 'play' | 'next' | 'queue' | 'background' | 'upgrade';

/** Why an acquisition failed. */
export type FailureReason =
  | 'no-candidates'
  | 'no-acceptable-quality'
  | 'all-candidates-failed'
  | 'verification-failed'
  | 'backend-unavailable'
  | 'quota-exceeded'
  | 'permission-denied'
  | 'timeout'
  | 'cancelled';

/** Where a browse result came from. */
export type Origin = 'library' | 'server' | 'catalog';

/** Whether the prefetch scheduler started or dropped a look-ahead acquisition. */
export type PrefetchDecision = 'started' | 'dropped';

/** The opinion a feedback call records: a like, a dislike, or neither. */
export type FeedbackValue = 'like' | 'dislike' | 'none';

/** Returns whether an acquisition state ends the acquisition. */
export function acquisitionIsTerminal(state: AcquisitionState): boolean {
  return state === 'completed' || state === 'failed' || state === 'cancelled';
}

/** The quality tier of the file a track is served from. */
export interface Quality {
  /** The container or codec suffix, for example `flac`. */
  format: string;
  /** The average bitrate in kilobits per second. */
  bitrateKbps: number;
  /** The sample rate in hertz. */
  sampleRate: number;
  /** The bit depth, or 0 when the format has none. */
  bitDepth: number;
  /** Whether the file is lossless. */
  lossless: boolean;
}

/** The `hearthsound` member of a track, album or artist. */
export interface HearthsoundMember {
  /** The availability the server reports for the entity. */
  availability: Availability;
  /** Whether the entity is in the caller's personal library. */
  inLibrary: boolean;
  /** Whether the caller has an active dislike on the entity. */
  disliked: boolean;
  /** Where the result came from. */
  origin: Origin;
  /**
   * How well the entity matches the search query, from 0 to 1. Search answers
   * carry it; the other endpoints leave it out.
   */
  score?: number;
  /** The active acquisition for this track, while one is running. */
  acquisitionId?: string;
  /** The quality of the file the track is served from, when one exists. */
  quality?: Quality;
  /**
   * The entity's readable path: one segment for an artist, the artist's segment
   * and the album's for an album.
   */
  path?: string;
  /** The segment of the artist a track is credited to. */
  artistPath?: string;
  /** The path of the album a track belongs to. */
  albumPath?: string;
}

/** The `hearthsound` member of a playlist: its lifetime and its origin. */
export interface PlaylistLifetime {
  /** Whether the playlist is temporary. */
  temporary: boolean;
  /** When the playlist expires, in unix milliseconds. */
  expiresAt?: number;
  /**
   * The listening service that generated the playlist, by its display name;
   * absent on a playlist the caller made.
   */
  generatedBy?: string;
}

/** A song, as the browse endpoints and `getSong` report it. */
export interface Child {
  /** The client id of the track. */
  id: string;
  /** The id of the containing folder or album. */
  parent?: string;
  /** Whether the object is a directory. */
  isDir?: boolean;
  /** The track title. */
  title?: string;
  /** The track name, which equals the title for a song. */
  name?: string;
  /** The album title. */
  album?: string;
  /** The display artist. */
  artist?: string;
  /** The track number within its disc. */
  track?: number;
  /** The release year. */
  year?: number;
  /** The primary genre. */
  genre?: string;
  /**
   * The edition label that tells this release apart from another release of one
   * title, empty when the release states none (the OpenSubsonic `version`).
   */
  version?: string;
  /** The id to pass to `getCoverArt`. */
  coverArt?: string;
  /** The file size in bytes, 0 while no file exists. */
  size?: number;
  /** The MIME type of the file, empty while no file exists. */
  contentType?: string;
  /** The file's container or codec suffix, empty while no file exists. */
  suffix?: string;
  /** The duration in seconds. */
  duration?: number;
  /** The average bitrate in kilobits per second. */
  bitRate?: number;
  /** The logical path the client shows. */
  path?: string;
  /** How often the caller played the track. */
  playCount?: number;
  /** When the track was added, as an ISO 8601 timestamp. */
  created?: string;
  /** The id of the album the track belongs to. */
  albumId?: string;
  /** The id of the artist the track belongs to. */
  artistId?: string;
  /** When the caller starred the track, as an ISO 8601 timestamp. */
  starred?: string;
  /** The caller's rating, 1 to 5. */
  userRating?: number;
  /** The Subsonic object type, `music` for a song. */
  type?: string;
  /** The vendor member, present because the client sends `hearthsound=1`. */
  hearthsound?: HearthsoundMember;
}

/** An album, as the browse endpoints and `getAlbum` report it. */
export interface AlbumID3 {
  /** The client id of the album. */
  id: string;
  /** The album title. */
  name: string;
  /** The display artist. */
  artist?: string;
  /** The id of the album artist. */
  artistId?: string;
  /** The id to pass to `getCoverArt`. */
  coverArt?: string;
  /** The number of tracks the album holds. */
  songCount?: number;
  /** The total duration in seconds. */
  duration?: number;
  /** How often the caller played the album. */
  playCount?: number;
  /** When the album was created, as an ISO 8601 timestamp. */
  created?: string;
  /** When the caller starred the album, as an ISO 8601 timestamp. */
  starred?: string;
  /** The release year. */
  year?: number;
  /** The primary genre. */
  genre?: string;
  /**
   * The edition label that tells this release apart from another release of one
   * title, empty when the release states none (the OpenSubsonic `version`).
   */
  version?: string;
  /** The vendor member, present because the client sends `hearthsound=1`. */
  hearthsound?: HearthsoundMember;
}

/** An album with its tracks, as `getAlbum` reports it. */
export interface AlbumWithSongs extends AlbumID3 {
  /** The album's tracks, in disc and track order. */
  song?: Child[];
}

/** An artist, as the browse endpoints and `getArtist` report it. */
export interface ArtistID3 {
  /** The client id of the artist. */
  id: string;
  /** The artist name. */
  name: string;
  /** The id to pass to `getCoverArt`. */
  coverArt?: string;
  /** The number of albums the artist is credited on. */
  albumCount?: number;
  /** When the caller starred the artist, as an ISO 8601 timestamp. */
  starred?: string;
  /** The vendor member, present because the client sends `hearthsound=1`. */
  hearthsound?: HearthsoundMember;
}

/** An artist with the albums attributed to it, as `getArtist` reports it. */
export interface ArtistWithAlbums extends ArtistID3 {
  /** The artist's albums. */
  album?: AlbumID3[];
}

/** One letter of the artist index. */
export interface ArtistIndex {
  /** The index letter, or a symbol such as `#` for the rest. */
  name: string;
  /** The artists under this letter. */
  artist?: ArtistID3[];
}

/** A playlist, as `getPlaylists` reports it. */
export interface Playlist {
  /** The client id of the playlist. */
  id: string;
  /** The playlist name. */
  name: string;
  /** The owner's comment. */
  comment?: string;
  /** The owner's username. */
  owner?: string;
  /** Whether the playlist is public. */
  public?: boolean;
  /** The number of tracks the playlist holds. */
  songCount?: number;
  /** The total duration in seconds. */
  duration?: number;
  /** When the playlist was created, as an ISO 8601 timestamp. */
  created?: string;
  /** When the playlist last changed, as an ISO 8601 timestamp. */
  changed?: string;
  /** The id to pass to `getCoverArt`. */
  coverArt?: string;
  /** The vendor member: whether the playlist is temporary. */
  hearthsound?: PlaylistLifetime;
}

/** A playlist with its tracks, as `getPlaylist` reports it. */
export interface PlaylistWithEntries extends Playlist {
  /** The playlist's tracks, in playlist order. */
  entry?: Child[];
}

/** The payload of `search3`. */
export interface SearchResult3 {
  /** The matching artists. */
  artist?: ArtistID3[];
  /** The matching albums. */
  album?: AlbumID3[];
  /** The matching songs. */
  song?: Child[];
}

/** The payload of `getAlbumList2`. */
export interface AlbumList2 {
  /** The albums of the requested page. */
  album?: AlbumID3[];
}

/** The payload of `getArtists`. */
export interface ArtistsIndex {
  /** The artists, grouped by index letter. */
  index?: ArtistIndex[];
}

/** The payload of `getStarred2`: the caller's liked entities. */
export interface Starred2 {
  /** The liked artists. */
  artist?: ArtistID3[];
  /** The liked albums. */
  album?: AlbumID3[];
  /** The liked songs. */
  song?: Child[];
}

/** The payload of `getPlaylists`. */
export interface PlaylistList {
  /** The visible playlists. */
  playlist?: Playlist[];
}

/** The payload of `hsGetRecommendedAlbums`. */
export interface RecommendedAlbums {
  /** The recommended albums, best match first. */
  album?: AlbumID3[];
}

/** The payload of `hsGetSimilarArtistAlbums`: the albums of similar artists. */
export interface SimilarArtistAlbums {
  /** The artist the recommendation started from; absent when the caller has no plays. */
  seedArtist?: ArtistID3;
  /** The albums of the similar artists, interleaved by artist. */
  album?: AlbumID3[];
}

/** The answer of `getSong`. */
export interface SongResponse {
  /** The song. */
  song?: Child;
}

/** The answer of `search3`. */
export interface Search3Response {
  /** The matching entities, local results first. */
  searchResult3?: SearchResult3;
}

/** The answer of `getAlbumList2`. */
export interface AlbumList2Response {
  /** The albums of the requested page. */
  albumList2?: AlbumList2;
}

/** The answer of `getArtists`. */
export interface ArtistsResponse {
  /** The artist index. */
  artists?: ArtistsIndex;
}

/** The answer of `getAlbum`. */
export interface AlbumResponse {
  /** The album with its tracks. */
  album?: AlbumWithSongs;
}

/** The answer of `getArtist`. */
export interface ArtistResponse {
  /** The artist with its albums. */
  artist?: ArtistWithAlbums;
}

/** The biography of an artist, as `getArtistInfo2` reports it. */
export interface ArtistInfo {
  /** The biography text; empty when no provider knew one. */
  biography?: string;
  /** The MusicBrainz artist id, empty when unknown. */
  musicBrainzId?: string;
  /** The Last.fm page, empty when unknown. */
  lastFmUrl?: string;
}

/** The answer of `getArtistInfo2`. */
export interface ArtistInfo2Response {
  /** The artist's information. */
  artistInfo2?: ArtistInfo;
}

/** The payload of `getTopSongs`. */
export interface TopSongs {
  /** The artist's most played tracks, most played first. */
  song?: Child[];
}

/** The answer of `getTopSongs`. */
export interface TopSongsResponse {
  /** The top songs. */
  topSongs?: TopSongs;
}

/** The entity a readable path names, as `hsResolve` reports it. */
export interface ResolvedPathAnswer {
  /** The entity's kind, `artist` or `album`. */
  type: string;
  /** The entity's client id. */
  id: string;
  /** The entity's canonical path. */
  path: string;
}

/** The answer of `hsResolve`. */
export interface ResolvedPathResponse {
  /** The entity the path names. */
  resolved?: ResolvedPathAnswer;
}

/** The answer of `getStarred2`. */
export interface Starred2Response {
  /** The caller's liked entities. */
  starred2?: Starred2;
}

/** The payload of `getRandomSongs`. */
export interface RandomSongs {
  /** The random tracks, in the server's order. */
  song?: Child[];
}

/** The answer of `getRandomSongs`. */
export interface RandomSongsResponse {
  /** The random tracks. */
  randomSongs?: RandomSongs;
}

/** The answer of `getPlaylists`. */
export interface PlaylistsResponse {
  /** The visible playlists. */
  playlists?: PlaylistList;
}

/** The answer of `getPlaylist`. */
export interface PlaylistResponse {
  /** The playlist with its tracks. */
  playlist?: PlaylistWithEntries;
}

/** The answer of `hsGetRecommendedAlbums`. */
export interface RecommendedAlbumsResponse {
  /** The recommendation the server answered with. */
  recommendedAlbums?: RecommendedAlbums;
}

/** The answer of `hsGetSimilarArtistAlbums`. */
export interface SimilarArtistAlbumsResponse {
  /** The recommendation and the artist it started from. */
  similarArtistAlbums?: SimilarArtistAlbums;
}

/** The answer of `hsGetAvailability`. */
export interface AvailabilityResponse {
  /** The availability of each requested id. */
  availabilities?: AvailabilityList;
}

/** The answer of `hsGetLibraryCounts`. */
export interface LibraryCountsResponse {
  /** How many items each list of the library holds. */
  libraryCounts?: LibraryCounts;
}

/** How many items each list of the library holds, in the caller's scope. */
export interface LibraryCounts {
  /** The artists in scope. */
  artists: number;
  /** The albums in scope. */
  albums: number;
  /** The songs in scope. */
  songs: number;
  /** The playlists the caller may see. */
  playlists: number;
  /** The artists the caller liked. */
  likedArtists: number;
  /** The albums the caller liked. */
  likedAlbums: number;
  /** The songs the caller liked. */
  likedSongs: number;
  /** The tracks the caller uploaded. */
  uploads: number;
}

/** The answer of `hsAcquire` and `hsGetAcquisitions`. */
export interface AcquisitionsResponse {
  /** The acquisitions of the request. */
  acquisitions?: AcquisitionList;
}

/** One entry of `hsGetAvailability`. */
export interface AvailabilityEntry {
  /** The id the entry answers for. */
  id: string;
  /** The availability of the entity. */
  state: Availability;
  /** Whether the entity is in the caller's personal library. */
  inLibrary: boolean;
  /** The active acquisition for this track, while one is running. */
  acquisitionId?: string;
  /** The download progress as a whole percentage, when one is known. */
  percent?: number;
  /** The estimated seconds until the download completes, when known. */
  etaSecs?: number;
  /** Whether the acquisition waits for a download source rather than running. */
  awaitingSource?: boolean;
  /** Why it waits, when the server named the cause. */
  parkReason?: ParkReason;
}

/** The payload of `hsGetAvailability`. */
export interface AvailabilityList {
  /** The availability of each requested id, in request order. */
  availability?: AvailabilityEntry[];
}

/** One row of `hsAcquire` and `hsGetAcquisitions`. */
export interface AcquisitionEntry {
  /** The acquisition's client id. */
  id: string;
  /** The client id of the track the acquisition is for. */
  targetId: string;
  /** The acquisition's current state. */
  state: AcquisitionState;
  /** The acquisition's current priority. */
  priority: Priority;
  /** The download progress as a whole percentage, when one is known. */
  percent?: number;
  /** The estimated seconds until the download completes, when known. */
  etaSecs?: number;
  /** The slug of the provider instance serving the acquisition. */
  instance?: string;
  /** Why the acquisition failed, when it has failed. */
  failureReason?: FailureReason;
  /** Whether the acquisition waits for a download source rather than running. */
  awaitingSource?: boolean;
  /** Why it waits, when the server named the cause. */
  parkReason?: ParkReason;
}

/** One id a bulk write did not apply. */
export interface BulkFailure {
  /** The id the server did not apply. */
  id: string;
  /** Why it did not, in the server's words. */
  reason: string;
}

/**
 * The per-id result of `hsSave`, `hsUnsave` and `hsSetFeedback`.
 *
 * Every id is applied in its own transaction, so one id a user may not write -
 * a catalog entity that could not be stored, a track that no longer exists -
 * does not discard the others. A server that does not answer the member applied
 * everything it was given.
 */
export interface BulkResult {
  /** The ids that were applied, in request order. */
  applied: string[];
  /** The ids that were not, each with the reason. */
  failed: BulkFailure[];
}

/** The payload of a bulk vendor write. */
export interface BulkResultResponse {
  /** The per-id result, present on a Hearthsound server. */
  bulkResult?: BulkResult;
}

/** The payload of `hsAcquire` and `hsGetAcquisitions`. */
export interface AcquisitionList {
  /** The acquisitions of the request, in request order. */
  acquisition?: AcquisitionEntry[];
}

/** The `error` member of a failed envelope. */
export interface SubsonicErrorBody {
  /** The Subsonic error code. */
  code: number;
  /** A human-readable explanation. */
  message?: string;
  /** A link to the documentation of the failure. */
  helpUrl?: string;
  /**
   * The Hearthsound-only reason the server stored for this refusal, sent only
   * to a client that asked for the vendor extension (A-web-player-6).
   */
  hearthsoundReason?: string;
}

/** The envelope every non-binary response carries. */
export interface SubsonicAnswer {
  /** Whether the call succeeded. */
  status: 'ok' | 'failed';
  /** The protocol version the server answers with. */
  version?: string;
  /** The server type, always `hearthsound`. */
  type?: string;
  /** The server's version. */
  serverVersion?: string;
  /** The OpenSubsonic marker. */
  openSubsonic?: boolean;
  /** Why the call failed; present only on a failed answer. */
  error?: SubsonicErrorBody;
}

/** An envelope carrying a payload of type `T`. */
export type Answer<T> = T & SubsonicAnswer;

/** One genre the collection holds, as `getGenres` reports it. */
export interface Genre {
  /** The genre's name. */
  name: string;
  /** How many songs carry it. */
  songCount: number;
  /** How many albums carry it. */
  albumCount: number;
}

/** The payload of `getGenres`. */
export interface Genres {
  /** The genres of the scope. */
  genre?: { content?: string; songCount?: number; albumCount?: number }[];
}

/** The answer of `getGenres`. */
export interface GenresResponse {
  /** The genres of the scope. */
  genres?: Genres;
}

/** The payload of `getSongsByGenre`. */
export interface SongsByGenre {
  /** The songs carrying the genre. */
  song?: Child[];
}

/** The answer of `getSongsByGenre`. */
export interface SongsByGenreResponse {
  /** The songs carrying the genre. */
  songsByGenre?: SongsByGenre;
}

/**
 * A queue one of the account's clients saved on the server (E-L-1).
 *
 * `savePlayQueue` writes it and `getPlayQueue` answers the most recent save
 * across that account's clients, so another device resumes where this one was.
 */
export interface PlayQueue {
  /** The id of the entry that was playing. */
  current?: string;
  /** How far into that entry playback was, in milliseconds. */
  position?: number;
  /** When the queue was saved, as an ISO timestamp. */
  changed?: string;
  /** The client that saved it. */
  changedBy?: string;
  /** The entries of the queue, in order. */
  entry?: Child[];
}

/** The answer of `getPlayQueue`. */
export interface PlayQueueAnswer {
  /** The saved queue, or absent when the account never saved one. */
  playQueue?: PlayQueue;
}
