/**
 * The artist's links, labels and release details.
 *
 * The native entity pages render what the server stored; the wording rules -
 * which link kinds a page shows, what a release type is called and how the
 * album's detail line is assembled - live here so the pages and their tests
 * share one answer.
 */
import type { AlbumSummary, LinkView } from './api';

/** The label each link kind is shown under. */
const LINK_LABELS: Record<string, string> = {
  homepage: 'Website',
  wikipedia: 'Wikipedia',
  wikidata: 'Wikidata',
  lastfm: 'Last.fm',
  discogs: 'Discogs',
  allmusic: 'AllMusic',
  bandcamp: 'Bandcamp',
  musicbrainz: 'MusicBrainz'
};

/** The label each release type is shown under. */
const TYPE_LABELS: Record<string, string> = {
  album: 'Album',
  ep: 'EP',
  single: 'Single',
  compilation: 'Compilation',
  live: 'Live',
  remix: 'Remix',
  soundtrack: 'Soundtrack'
};

/** One external page as the artist page links it. */
export interface ArtistLink {
  /** The visible label. */
  label: string;
  /** The page's URL. */
  url: string;
}

/**
 * Returns the links the artist page shows.
 *
 * The kinds a reader knows are kept, in the order the server listed them; a
 * kind this client has no label for is left out rather than shown as a bare
 * URL title.
 *
 * @param links The stored links.
 * @returns The links to render.
 */
export function artistLinks(links: readonly LinkView[]): ArtistLink[] {
  return links.flatMap((link) => {
    const label = LINK_LABELS[link.kind];
    return label === undefined || link.url === '' ? [] : [{ label, url: link.url }];
  });
}

/**
 * Returns the label of a release type.
 *
 * @param albumType The type the server stored.
 * @returns The label, or `undefined` for a type this page does not name.
 */
export function albumTypeLabel(albumType: string | null): string | undefined {
  return albumType === null ? undefined : TYPE_LABELS[albumType];
}

/**
 * Returns the date an album's page states.
 *
 * A full release date is written in the reader's locale; a partial date, and a
 * release that states only its year, fall back to the year.
 *
 * @param releaseDate The stored release date, `YYYY`, `YYYY-MM` or `YYYY-MM-DD`.
 * @param year The stored year.
 * @returns The date line, or `undefined` when neither is known.
 */
export function releaseDateLabel(
  releaseDate: string | null,
  year: number | null
): string | undefined {
  if (releaseDate !== null && releaseDate.length === 10) {
    const date = new Date(`${releaseDate}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat(undefined, { dateStyle: 'long' }).format(date);
    }
  }
  if (year !== null && year > 0) {
    return String(year);
  }
  const partial = releaseDate?.slice(0, 4) ?? '';
  return /^\d{4}$/.test(partial) ? partial : undefined;
}

/**
 * Builds the album page's muted detail line.
 *
 * @param album The album's release fields.
 * @returns The date, type and edition that are known, joined by ` - `.
 */
export function releaseDetails(album: {
  releaseDate: string | null;
  year: number | null;
  albumType: string | null;
  edition: string | null;
}): string {
  const parts = [
    releaseDateLabel(album.releaseDate, album.year),
    albumTypeLabel(album.albumType),
    album.edition === null || album.edition === '' ? undefined : album.edition
  ].filter((part): part is string => part !== undefined);
  return parts.join(' - ');
}

/**
 * Builds the line under an album card on the artist page.
 *
 * The artist page leads with the release year and names an EP or a single
 * beside it, so a discography of one artist reads apart at a glance.
 *
 * @param album The album the card draws.
 * @returns The line, or `undefined` when no year and no type are known.
 */
export function albumCardSubtitle(album: AlbumSummary): string | undefined {
  const year = album.year !== null && album.year > 0 ? String(album.year) : undefined;
  const type =
    album.albumType === 'ep' ? 'EP' : album.albumType === 'single' ? 'Single' : undefined;
  const parts = [year, type].filter((part): part is string => part !== undefined);
  return parts.length === 0 ? undefined : parts.join(' - ');
}
