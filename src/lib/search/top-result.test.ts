/**
 * Tests for the Top Result choice: the b03 equality order and what the card
 * shows for each entity kind.
 */
import { describe, expect, it } from 'vitest';

import { topResultOf } from './top-result';
import type { AlbumID3, ArtistID3, Child } from '#lib/subsonic/types';

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

  it('promotes an exactly named artist before an album and a song', () => {
    const result = topResultOf([song('Dusk')], [album('Dusk')], [artist('Dusk')], 'Dusk');

    expect(result?.kind).toBe('Artist');
    expect(result?.entity.kind).toBe('artist');
  });

  it('ignores case and accents in the equality test', () => {
    const result = topResultOf([], [album('Caf\u00e9 Del Mar')], [artist('Other')], 'cafe del mar');

    expect(result?.kind).toBe('Album');
    expect(result?.name).toBe('Caf\u00e9 Del Mar');
  });

  it('promotes an exactly named song when nothing else matches', () => {
    const result = topResultOf([song('Dusk')], [], [artist('Other')], 'dusk');

    expect(result?.kind).toBe('Song');
  });

  it('falls back to the first artist, then the first album, then the first song', () => {
    expect(topResultOf([song('A')], [album('B')], [artist('C')], 'nothing')?.kind).toBe('Artist');
    expect(topResultOf([song('A')], [album('B')], [], 'nothing')?.kind).toBe('Album');
    expect(topResultOf([song('A')], [], [], 'nothing')?.kind).toBe('Song');
  });

  it('links a song to its album, then its artist, then nowhere', () => {
    expect(topResultOf([song('A', { albumId: 'al_1', artistId: 'ar_1' })], [], [], 'a')?.href).toBe(
      '/album/al_1'
    );
    expect(topResultOf([song('A', { artistId: 'ar_1' })], [], [], 'a')?.href).toBe('/artist/ar_1');
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
