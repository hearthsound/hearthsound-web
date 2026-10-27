/**
 * One track as a row draws it, whichever API answered.
 *
 * The native API answers a `TrackSummary` and the Subsonic surface answers a
 * `Child`; both name the same stored row and both feed a song row, a song menu
 * and the player's queue. This is the small shape those views read, so a view
 * takes one type instead of knowing which surface its answer came from.
 */
export interface Song {
  /** The track's client id (`tr_...`). */
  id: string;
  /** The title. */
  title?: string;
  /** The title, as a Subsonic child spells it. */
  name?: string;
  /** The display artist. */
  artist?: string;
  /** The album's title. */
  album?: string;
  /** The track number within its disc. */
  track?: number;
  /** The duration in seconds. */
  duration?: number;
  /** The album's client id. */
  albumId?: string;
  /** The credited artist's client id. */
  artistId?: string;
  /** The id to pass to the image endpoint, when an image is stored. */
  coverArt?: string;
  /** The MIME type of the stored file, empty while no file exists. */
  contentType?: string;
  /** Whether the caller likes the track. */
  liked?: boolean;
  /** Whether the caller dislikes the track. */
  disliked?: boolean;
  /** Whether the caller's personal library holds the track. */
  inLibrary?: boolean;
  /** The caller's rating, from 1 to 5. */
  userRating?: number;
  /** When the caller liked the track, as an ISO 8601 timestamp. */
  starred?: string;
  /** The vendor member a Subsonic answer carries. */
  hearthsound?: { disliked?: boolean; inLibrary?: boolean } | null;
}

/**
 * Returns the title a row draws.
 *
 * @param song The track.
 * @returns The title, never `undefined`.
 */
export function songTitle(song: Song): string {
  return song.title ?? song.name ?? '';
}
