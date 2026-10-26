/**
 * The second line of an album card.
 *
 * Two releases of one title look identical in a grid, so a card says which
 * edition it is: the album's edition label, as the server derives it from the
 * release's disambiguation tag or the album's folder, follows the artist after a
 * hyphen. Cards a title, an artist and an edition still cannot tell apart say the
 * year instead, so two "Twin Fantasy" cards read apart.
 */
import type { AlbumID3 } from '#lib/subsonic/types';

/** Returns what one card says under the album's name. */
export type SubtitleOf = (album: AlbumID3) => string | undefined;

/**
 * Builds the subtitle of an album card: the artist, and the edition when the
 * release states one.
 *
 * @param album The album the card draws.
 * @returns The line, or `undefined` when the album names neither an artist nor an
 * edition.
 */
export function albumSubtitle(album: AlbumID3): string | undefined {
  const edition = album.version ?? '';
  const parts = [album.artist ?? '', edition].filter((part) => part !== '');
  return parts.length === 0 ? undefined : parts.join(' - ');
}

/**
 * Builds the subtitles of one grid's cards.
 *
 * Within a grid, cards that share their displayed title and their artist and that
 * would draw the same subtitle are the ones a reader cannot tell apart, so each of
 * them also says its year, or "No year" when it has none.
 *
 * @param albums The albums the grid draws, in the order it draws them.
 * @param base Builds the subtitle a card draws before the year is added; the
 * artist page shows the year first (p16-r1) and passes its own.
 * @returns Each album's subtitle, by album id.
 */
export function gridSubtitles(
  albums: readonly AlbumID3[],
  base: SubtitleOf = albumSubtitle
): Map<string, string | undefined> {
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
    const buckets = new Map<string, AlbumID3[]>();
    for (const album of group) {
      const key = subtitles.get(album.id) ?? '';
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
  return subtitles;
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
