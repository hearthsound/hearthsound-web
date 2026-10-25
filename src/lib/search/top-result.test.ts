/**
 * Tests for the Top Result choice: the highest relevance score, the artist,
 * album, song order that breaks a tie, and what the card shows for each kind.
 */
import { describe, expect, it } from 'vitest';

import { topResultOf } from './top-result';
import type { AlbumID3, ArtistID3, Child, HearthsoundMember } from '#lib/subsonic/types';

/**
 * The vendor member of an entity with the given relevance score.
 *
 * @param score The relevance score the server reported.
 * @returns The vendor member.
 */
function scored(score: number): HearthsoundMember {
  return { availability: 'local', inLibrary: true, disliked: false, origin: 'library', score };
}

/**
 * The vendor member of an entity that carries readable paths.
 *
 * @param albumPath The album's path, when the entity has one.
 * @param artistPath The artist's segment or path.
 * @returns The vendor member.
 */
function paths(albumPath: string | undefined, artistPath: string): HearthsoundMember {
  return {
    availability: 'local',
    inLibrary: false,
    disliked: false,
    origin: 'catalog',
    albumPath,
    artistPath
  };
}

/** An album with the given name. */
function album(name: string, fields: Partial<AlbumID3> = {}): AlbumID3 {
  return { id: `al_${name}`, name, ...fields };
}

/** An artist with the given name. */
function artist(name: string, fields: Partial<ArtistID3> = {}): ArtistID3 {
  return { id: `ar_${name}`, name, ...fields };
}

/** A track with the given title. */
function song(title: string, fields: Partial<Child> = {}): Child {
  return { id: `so_${title}`, title, ...fields };
}

describe('top result', () => {
  it('shows nothing before an answer', () => {
    expect(topResultOf([song('A')], [album('A')], [artist('A')], null)).toBeNull();
  });

  it('shows nothing for an answer with no entity', () => {
    expect(topResultOf([], [], [], 'nothing')).toBeNull();
  });

  it('picks the entity with the highest relevance score', () => {
    const result = topResultOf(
      [song('Dusk', { hearthsound: scored(0.9) })],
      [album('Dusk', { hearthsound: scored(0.7) })],
      [artist('Dusk', { hearthsound: scored(0.5) })],
      'Dusk'
    );

    expect(result?.kind).toBe('Song');
    expect(result?.entity.kind).toBe('song');
  });

  it('ranks an earlier kind above a later one on a tie', () => {
    const tied = scored(0.9);

    expect(
      topResultOf(
        [song('Dusk', { hearthsound: tied })],
        [album('Dusk', { hearthsound: tied })],
        [artist('Dusk', { hearthsound: tied })],
        'Dusk'
      )?.kind
    ).toBe('Artist');
    expect(
      topResultOf(
        [song('Dusk', { hearthsound: tied })],
        [album('Dusk', { hearthsound: tied })],
        [],
        'Dusk'
      )?.kind
    ).toBe('Album');
    expect(topResultOf([song('Dusk', { hearthsound: tied })], [], [], 'Dusk')?.kind).toBe('Song');
  });

  it('keeps the server order among entities that tie inside a kind', () => {
    const result = topResultOf(
      [song('First', { hearthsound: scored(0.4) }), song('Second', { hearthsound: scored(0.4) })],
      [],
      [],
      'nothing'
    );

    expect(result?.name).toBe('First');
  });

  it('treats an entity without a score as the lowest score', () => {
    const result = topResultOf(
      [song('Plain')],
      [album('Scored', { hearthsound: scored(0.2) })],
      [artist('Plain')],
      'plain'
    );

    expect(result?.kind).toBe('Album');
  });

  it('falls back to the first entity in kind order when nothing is scored', () => {
    expect(topResultOf([song('A')], [album('B')], [artist('C')], 'nothing')?.kind).toBe('Artist');
    expect(topResultOf([song('A')], [album('B')], [], 'nothing')?.kind).toBe('Album');
    expect(topResultOf([song('A')], [], [], 'nothing')?.kind).toBe('Song');
  });

  it('links a song to its album, then its artist, then nowhere', () => {
    const both = topResultOf(
      [
        song('A', {
          albumId: 'al_1',
          artistId: 'ar_1',
          hearthsound: paths('a/a', 'a')
        })
      ],
      [],
      [],
      'a'
    );
    expect(both?.href).toBe('/album/a/a');
    expect(both?.target).toBe('al_1');
    expect(
      topResultOf(
        [song('A', { artistId: 'ar_1', hearthsound: paths(undefined, 'a') })],
        [],
        [],
        'a'
      )?.href
    ).toBe('/artist/a');
    expect(topResultOf([song('A')], [], [], 'a')?.href).toBeUndefined();
  });

  it('gives each kind its icon and its muted line', () => {
    expect(topResultOf([], [], [artist('A')], 'a')).toMatchObject({
      icon: 'adwaita-artist',
      artist: 'A'
    });
    expect(topResultOf([], [album('A', { artist: 'The Band' })], [], 'a')).toMatchObject({
      icon: 'adwaita-album',
      artist: 'The Band'
    });
    expect(topResultOf([song('A', { artist: 'The Band' })], [], [], 'a')).toMatchObject({
      icon: 'adwaita-song',
      artist: 'The Band'
    });
  });

  it('has no artwork for an entity without a cover', () => {
    expect(topResultOf([], [], [artist('A')], 'a')?.art).toBeUndefined();
    expect(topResultOf([], [], [artist('A', { coverArt: 'co_1' })], 'a')?.art).toContain('co_1');
  });
});
