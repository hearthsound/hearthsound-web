/**
 * The entity a search answer promotes to the Top Result card (p18, b03).
 *
 * The card is the answer's most relevant entity. The core does not expose a
 * relevance score yet, so the client picks one by name: an artist, an album or
 * a song whose name equals the query, case and accents ignored, in that order;
 * otherwise the first artist, album or song the answer carries. Everything the
 * card renders - its muted line, its page and its artwork - is built here, so
 * the assembly can be tested without a component.
 */
import type { IconName } from '@hearthsound/design/icons';

import { coverArtUrl } from '#lib/player/stream';
import type { AlbumID3, ArtistID3, Child } from '#lib/subsonic/types';

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
 * Normalises a name for the equality test: case and accents ignored.
 *
 * @param value The name or the query.
 * @returns The comparable form.
 */
function accentFree(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

/**
 * The track's name.
 *
 * @param song The track.
 * @returns Its title, or its name.
 */
function songName(song: Child): string {
  return song.title ?? song.name ?? '';
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
    name: songName(song),
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
  const wanted = accentFree(asked);
  const equals = (name: string | undefined): boolean => accentFree(name ?? '') === wanted;

  const artist = artists.find((entry) => equals(entry.name));
  if (artist !== undefined) {
    return artistResult(artist);
  }
  const album = albums.find((entry) => equals(entry.name));
  if (album !== undefined) {
    return albumResult(album);
  }
  const song = songs.find((entry) => equals(songName(entry)));
  if (song !== undefined) {
    return songResult(song);
  }
  if (artists[0] !== undefined) {
    return artistResult(artists[0]);
  }
  if (albums[0] !== undefined) {
    return albumResult(albums[0]);
  }
  if (songs[0] !== undefined) {
    return songResult(songs[0]);
  }
  return null;
}
