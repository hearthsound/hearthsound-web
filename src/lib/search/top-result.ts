/**
 * The entity a search answer promotes to the Top Result card (p18, b03).
 *
 * The card is the answer's most relevant entity: the one whose relevance score
 * the server reports is highest. An artist, an album and a song that score the
 * same are ranked in that order, and otherwise the server's own order decides.
 * Everything the card renders - its muted line, its page and its artwork - is
 * built here, so the assembly can be tested without a component.
 */
import type { IconName } from '@hearthsound/design/icons';

import { coverArtUrl } from '#lib/player/stream';
import type { AlbumID3, ArtistID3, Child, HearthsoundMember } from '#lib/subsonic/types';

/** The size of the Top Result artwork, in pixels. */
const TOP_RESULT_ART_SIZE = 192;

/** The entity the card shows. */
export type TopEntity =
  | { kind: 'artist'; artist: ArtistID3 }
  | { kind: 'album'; album: AlbumID3 }
  | { kind: 'song'; song: Child };

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
 * The artwork URL of a cover id.
 *
 * @param coverArt The `getCoverArt` id, when there is one.
 * @returns The URL, or `undefined` for the placeholder.
 */
function artOf(coverArt: string | undefined): string | undefined {
  return coverArt === undefined || coverArt === ''
    ? undefined
    : coverArtUrl(coverArt, TOP_RESULT_ART_SIZE);
}

/**
 * Builds the card for an artist.
 *
 * @param artist The artist.
 * @returns The card's entity.
 */
function artistResult(artist: ArtistID3): TopResultView {
  return {
    name: artist.name,
    kind: 'Artist',
    artist: artist.name,
    href: `/artist/${artist.id}`,
    art: artOf(artist.coverArt),
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
function albumResult(album: AlbumID3): TopResultView {
  return {
    name: album.name,
    kind: 'Album',
    artist: album.artist ?? '',
    href: `/album/${album.id}`,
    art: artOf(album.coverArt),
    icon: 'adwaita-album',
    entity: { kind: 'album', album }
  };
}

/**
 * Builds the card for a song; its link opens the album or artist page.
 *
 * @param song The track.
 * @returns The card's entity.
 */
function songResult(song: Child): TopResultView {
  return {
    name: song.title ?? song.name ?? '',
    kind: 'Song',
    artist: song.artist ?? '',
    href:
      song.albumId !== undefined && song.albumId !== ''
        ? `/album/${song.albumId}`
        : song.artistId !== undefined && song.artistId !== ''
          ? `/artist/${song.artistId}`
          : undefined,
    art: artOf(song.coverArt),
    icon: 'adwaita-song',
    entity: { kind: 'song', song }
  };
}

/**
 * Picks the entity a search answer promotes to the Top Result (b03).
 *
 * @param songs The matching tracks.
 * @param albums The matching albums.
 * @param artists The matching artists.
 * @param asked The query the answer belongs to.
 * @returns The card's entity, or `null` before an answer.
 */
export function topResultOf(
  songs: readonly Child[],
  albums: readonly AlbumID3[],
  artists: readonly ArtistID3[],
  asked: string | null
): TopResultView | null {
  if (asked === null) {
    return null;
  }
  const scoreOf = (entity: { hearthsound?: HearthsoundMember }): number =>
    entity.hearthsound?.score ?? 0;
  const candidates: { score: number; view: () => TopResultView }[] = [
    ...artists.map((artist) => ({
      score: scoreOf(artist),
      view: () => artistResult(artist)
    })),
    ...albums.map((album) => ({
      score: scoreOf(album),
      view: () => albumResult(album)
    })),
    ...songs.map((song) => ({
      score: scoreOf(song),
      view: () => songResult(song)
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
