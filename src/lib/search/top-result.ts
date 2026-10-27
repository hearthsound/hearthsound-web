/**
 * The entity a search answer promotes to the Top Result card (p18, b03).
 *
 * The card is the answer's most relevant entity: the one whose relevance score
 * the answer reports is highest. An artist, an album and a song that score the
 * same are ranked in that order, and otherwise the server's own order decides.
 * Everything the card renders - its muted line, its page and its artwork - is
 * built here, so the assembly can be tested without a component.
 */
import type { IconName } from '@hearthsound/design/icons';

import type { AlbumSummary, ArtistSummary, TrackSummary } from '#lib/entities/api';
import { albumHref, artistHref } from '#lib/paths';
import { coverArtUrl } from '#lib/player/stream';

/** The size of the Top Result artwork, in pixels. */
const TOP_RESULT_ART_SIZE = 192;

/** The entity the card shows. */
export type TopEntity =
  | { kind: 'artist'; artist: ArtistSummary }
  | { kind: 'album'; album: AlbumSummary }
  | { kind: 'song'; track: TrackSummary };

/** What the Top Result card renders. */
export interface TopResultView {
  /** The entity's name. */
  name: string;
  /** Its kind, "Artist", "Album" or "Song". */
  kind: 'Artist' | 'Album' | 'Song';
  /** The artist the muted line names. */
  artist: string;
  /** Its page, when it has one. */
  href?: string;
  /** Its artwork, when it has one. */
  art?: string;
  /** The tile shown for missing artwork. */
  icon: IconName;
  /** The entity the card stands for. */
  entity: TopEntity;
}

/**
 * The artwork URL of an entity that holds an image.
 *
 * @param image The entity's id and whether the server holds an image for it.
 * @returns The URL, or `undefined` for the placeholder.
 */
function artOf(image: { id: string; hasImage: boolean }): string | undefined {
  return image.hasImage ? coverArtUrl(image.id, TOP_RESULT_ART_SIZE) : undefined;
}

/**
 * Builds the card for an artist.
 *
 * @param artist The artist.
 * @returns The card's entity.
 */
function artistResult(artist: ArtistSummary): TopResultView {
  return {
    name: artist.name,
    kind: 'Artist',
    artist: artist.name,
    href: artistHref(artist.id),
    art: artOf(artist),
    icon: 'adwaita-artist',
    entity: { kind: 'artist', artist }
  };
}

/**
 * Builds the card for an album.
 *
 * @param album The album.
 * @returns The card's entity.
 */
function albumResult(album: AlbumSummary): TopResultView {
  return {
    name: album.title,
    kind: 'Album',
    artist: album.displayArtist ?? '',
    href: albumHref(album.id),
    art: artOf(album),
    icon: 'adwaita-album',
    entity: { kind: 'album', album }
  };
}

/**
 * Builds the card for a song; its link opens the album or artist page.
 *
 * The album's page is preferred, so the link names the release rather than its
 * artist; a song no album carries links to its first credited artist.
 *
 * @param track The track.
 * @returns The card's entity.
 */
function songResult(track: TrackSummary): TopResultView {
  const artist = track.artists[0] ?? null;
  return {
    name: track.title,
    kind: 'Song',
    artist: track.artists.map((credit) => credit.name).join(', '),
    href:
      track.albumId !== null
        ? albumHref(track.albumId)
        : artist === null
          ? undefined
          : artistHref(artist.id),
    art: artOf(track),
    icon: 'adwaita-song',
    entity: { kind: 'song', track }
  };
}

/**
 * Picks the entity a search answer promotes to the Top Result (b03).
 *
 * @param tracks The matching tracks.
 * @param albums The matching albums.
 * @param artists The matching artists.
 * @param asked The query the answer belongs to.
 * @returns The card's entity, or `null` before an answer.
 */
export function topResultOf(
  tracks: readonly TrackSummary[],
  albums: readonly AlbumSummary[],
  artists: readonly ArtistSummary[],
  asked: string | null
): TopResultView | null {
  if (asked === null) {
    return null;
  }
  const candidates: { score: number; view: () => TopResultView }[] = [
    ...artists.map((artist) => ({
      score: artist.score ?? 0,
      view: () => artistResult(artist)
    })),
    ...albums.map((album) => ({
      score: album.score ?? 0,
      view: () => albumResult(album)
    })),
    ...tracks.map((track) => ({
      score: track.score ?? 0,
      view: () => songResult(track)
    }))
  ];
  // A strict comparison keeps the earlier candidate on a tie, which ranks an
  // artist before an album before a song and otherwise keeps the server order.
  let best: { score: number; view: () => TopResultView } | null = null;
  for (const candidate of candidates) {
    if (best === null || candidate.score > best.score) {
      best = candidate;
    }
  }
  return best === null ? null : best.view();
}
