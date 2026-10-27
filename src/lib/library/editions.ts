/**
 * What an album card calls an album, and what it says under the name.
 *
 * A release's edition belongs to the release, never to the artist, so it never
 * sits beside the artist's name. It is a disambiguator, not a fact a card states
 * on its own: a card appends it to the album's name in parentheses - "Solar
 * Power (Deluxe Edition)" - only when the listing also holds another album of
 * that name by the same artist, so one release with an edition label reads as
 * its plain name. Cards still indistinguishable after that say the year under
 * the name, so two "Twin Fantasy" cards read apart.
 */
import type { AlbumID3 } from '#lib/subsonic/types';

/** Returns what one card says under the album's name. */
export type SubtitleOf = (album: AlbumID3) => string | undefined;

/** What one grid draws on its cards. */
export interface AlbumLabels {
  /** The name on each card, by album id. */
  titles: Map<string, string>;
  /** The line under each name, by album id. */
  subtitles: Map<string, string | undefined>;
}

/**
 * Builds the subtitle of an album card: the artist.
 *
 * @param album The album the card draws.
 * @returns The artist, or `undefined` when the album names none.
 */
export function albumSubtitle(album: AlbumID3): string | undefined {
  return album.artist === undefined || album.artist === '' ? undefined : album.artist;
}

/**
 * Builds the names and subtitles of one grid's cards.
 *
 * Albums that share a name and an artist are versions of one album, so each of
 * their cards appends its edition label when the release states one, and two of
 * them that would still draw the same line under the same name say their year
 * instead ("No year" without one).
 *
 * @param albums The albums the grid draws, in the order it draws them.
 * @param base Builds the subtitle a card draws before the year is added; the
 * artist page shows the year first (p16-r1) and passes its own.
 * @returns Each album's name and subtitle, by album id.
 */
export function albumLabels(
  albums: readonly AlbumID3[],
  base: SubtitleOf = albumSubtitle
): AlbumLabels {
  const titles = new Map<string, string>(albums.map((album) => [album.id, album.name]));
  const subtitles = new Map<string, string | undefined>(
    albums.map((album) => [album.id, base(album)])
  );
  const groups = new Map<string, AlbumID3[]>();
  for (const album of albums) {
    const key = `${album.name}\u0000${album.artist ?? ''}`;
    const group = groups.get(key);
    if (group === undefined) {
      groups.set(key, [album]);
    } else {
      group.push(album);
    }
  }
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    for (const album of group) {
      const edition = album.version ?? '';
      if (edition !== '') {
        titles.set(album.id, `${album.name} (${edition})`);
      }
    }
    // Versions whose editions differ now read apart; the rest fall back to the
    // year, which is the last thing a reader has to tell them apart.
    const buckets = new Map<string, AlbumID3[]>();
    for (const album of group) {
      const key = `${titles.get(album.id) ?? ''}\u0000${subtitles.get(album.id) ?? ''}`;
      const bucket = buckets.get(key);
      if (bucket === undefined) {
        buckets.set(key, [album]);
      } else {
        bucket.push(album);
      }
    }
    for (const bucket of buckets.values()) {
      if (bucket.length < 2) {
        continue;
      }
      for (const album of bucket) {
        subtitles.set(album.id, withYear(subtitles.get(album.id), album));
      }
    }
  }
  return { titles, subtitles };
}

/**
 * Adds an album's year to a subtitle.
 *
 * @param subtitle The subtitle the card draws now.
 * @param album The album the card draws.
 * @returns The subtitle with the year after it, or the year alone when there was
 * no subtitle.
 */
function withYear(subtitle: string | undefined, album: AlbumID3): string {
  const year = album.year !== undefined && album.year > 0 ? String(album.year) : 'No year';
  if (subtitle === undefined || subtitle === '') {
    return year;
  }
  if (year !== 'No year' && subtitle.includes(year)) {
    return subtitle;
  }
  return `${subtitle} - ${year}`;
}
