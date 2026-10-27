/**
 * Tests for the Top Result choice: the highest relevance score, the artist,
 * album, song order that breaks a tie, and what the card shows for each kind.
 */
import { describe, expect, it } from 'vitest';

import type { AlbumSummary, ArtistSummary, TrackSummary } from '#lib/entities/api';

import { topResultOf } from './top-result';

/** An album with the given title. */
function album(title: string, fields: Partial<AlbumSummary> = {}): AlbumSummary {
  return {
    id: `al_${title}`,
    title,
    edition: null,
    year: null,
    albumType: null,
    displayArtist: null,
    artistId: null,
    hasImage: false,
    inLibrary: false,
    ...fields
  };
}

/** An artist with the given name. */
function artist(name: string, fields: Partial<ArtistSummary> = {}): ArtistSummary {
  return { id: `ar_${name}`, name, hasImage: false, inLibrary: false, ...fields };
}

/** A track with the given title. */
function track(title: string, fields: Partial<TrackSummary> = {}): TrackSummary {
  return {
    id: `tr_${title}`,
    title,
    artists: [],
    albumId: null,
    albumTitle: null,
    discNumber: null,
    trackNumber: null,
    durationMs: null,
    explicit: null,
    availability: 'remote',
    inLibrary: false,
    liked: false,
    disliked: false,
    rating: null,
    hasImage: false,
    ...fields
  };
}

describe('top result', () => {
  it('shows nothing before an answer', () => {
    expect(topResultOf([track('A')], [album('A')], [artist('A')], null)).toBeNull();
  });

  it('shows nothing for an answer with no entity', () => {
    expect(topResultOf([], [], [], 'nothing')).toBeNull();
  });

  it('picks the entity with the highest relevance score', () => {
    const result = topResultOf(
      [track('Dusk', { score: 0.9 })],
      [album('Dusk', { score: 0.7 })],
      [artist('Dusk', { score: 0.5 })],
      'Dusk'
    );

    expect(result?.kind).toBe('Song');
    expect(result?.entity.kind).toBe('song');
  });

  it('ranks an earlier kind above a later one on a tie', () => {
    expect(
      topResultOf(
        [track('Dusk', { score: 0.9 })],
        [album('Dusk', { score: 0.9 })],
        [artist('Dusk', { score: 0.9 })],
        'Dusk'
      )?.kind
    ).toBe('Artist');
    expect(
      topResultOf([track('Dusk', { score: 0.9 })], [album('Dusk', { score: 0.9 })], [], 'Dusk')
        ?.kind
    ).toBe('Album');
    expect(topResultOf([track('Dusk', { score: 0.9 })], [], [], 'Dusk')?.kind).toBe('Song');
  });

  it('keeps the server order among entities that tie inside a kind', () => {
    const result = topResultOf(
      [track('First', { score: 0.4 }), track('Second', { score: 0.4 })],
      [],
      [],
      'nothing'
    );

    expect(result?.name).toBe('First');
  });

  it('treats an entity without a score as the lowest score', () => {
    const result = topResultOf(
      [track('Plain')],
      [album('Scored', { score: 0.2 })],
      [artist('Plain')],
      'plain'
    );

    expect(result?.kind).toBe('Album');
  });

  it('falls back to the first entity in kind order when nothing is scored', () => {
    expect(topResultOf([track('A')], [album('B')], [artist('C')], 'nothing')?.kind).toBe('Artist');
    expect(topResultOf([track('A')], [album('B')], [], 'nothing')?.kind).toBe('Album');
    expect(topResultOf([track('A')], [], [], 'nothing')?.kind).toBe('Song');
  });

  it('links a song to its album, then its artist, then nowhere', () => {
    const both = topResultOf(
      [
        track('A', {
          albumId: 'al_1',
          artists: [{ id: 'ar_1', name: 'The Band' }]
        })
      ],
      [],
      [],
      'a'
    );
    expect(both?.href).toBe('/album/al_1');
    expect(
      topResultOf([track('A', { artists: [{ id: 'ar_1', name: 'The Band' }] })], [], [], 'a')?.href
    ).toBe('/artist/ar_1');
    expect(topResultOf([track('A')], [], [], 'a')?.href).toBeUndefined();
  });

  it('gives each kind its icon and its muted line', () => {
    expect(topResultOf([], [], [artist('A')], 'a')).toMatchObject({
      icon: 'adwaita-artist',
      artist: 'A'
    });
    expect(topResultOf([], [album('A', { displayArtist: 'The Band' })], [], 'a')).toMatchObject({
      icon: 'adwaita-album',
      artist: 'The Band'
    });
    expect(
      topResultOf([track('A', { artists: [{ id: 'ar_1', name: 'The Band' }] })], [], [], 'a')
    ).toMatchObject({
      icon: 'adwaita-song',
      artist: 'The Band'
    });
  });

  it('has no artwork for an entity without a cover', () => {
    expect(topResultOf([], [], [artist('A')], 'a')?.art).toBeUndefined();
    expect(topResultOf([], [], [artist('A', { hasImage: true })], 'a')?.art).toBe(
      '/api/v1/images/ar_A?size=192'
    );
  });
});
