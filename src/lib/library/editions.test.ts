/**
 * Tests for the album card subtitle: the edition label and the year a grid adds
 * when two cards would otherwise look identical.
 */
import { describe, expect, it } from 'vitest';

import { albumSubtitle, gridSubtitles } from '#lib/library/editions';
import type { AlbumID3 } from '#lib/subsonic/types';

/** Builds an album with the fields a card reads. */
function album(fields: Partial<AlbumID3> & Pick<AlbumID3, 'id' | 'name'>): AlbumID3 {
  return { artist: 'Lorde', ...fields };
}

describe('albumSubtitle', () => {
  it('names the artist alone when the release states no edition', () => {
    expect(albumSubtitle(album({ id: 'a', name: 'Solar Power' }))).toBe('Lorde');
  });

  it('adds the edition after the artist', () => {
    expect(albumSubtitle(album({ id: 'a', name: 'Solar Power', version: 'Deluxe Edition' }))).toBe(
      'Lorde - Deluxe Edition'
    );
  });

  it('draws the edition alone when no artist is known', () => {
    expect(
      albumSubtitle(album({ id: 'a', name: 'Solar Power', artist: undefined, version: 'Live' }))
    ).toBe('Live');
  });

  it('draws nothing when neither is known', () => {
    expect(
      albumSubtitle(album({ id: 'a', name: 'Solar Power', artist: undefined }))
    ).toBeUndefined();
  });
});

describe('gridSubtitles', () => {
  it('leaves unrelated albums on their artist', () => {
    const subtitles = gridSubtitles([
      album({ id: 'a', name: 'Solar Power' }),
      album({ id: 'b', name: 'Melodrama' })
    ]);
    expect(subtitles.get('a')).toBe('Lorde');
    expect(subtitles.get('b')).toBe('Lorde');
  });

  it('tells two releases of one title apart by their editions', () => {
    const subtitles = gridSubtitles([
      album({ id: 'a', name: 'Solar Power' }),
      album({ id: 'b', name: 'Solar Power', version: 'Deluxe Edition' })
    ]);
    expect(subtitles.get('a')).toBe('Lorde');
    expect(subtitles.get('b')).toBe('Lorde - Deluxe Edition');
  });

  it('adds the year when neither card states an edition', () => {
    const subtitles = gridSubtitles([
      album({
        id: 'a',
        name: 'Twin Fantasy (Face to Face)',
        artist: 'Car Seat Headrest',
        year: 2018
      }),
      album({ id: 'b', name: 'Twin Fantasy (Face to Face)', artist: 'Car Seat Headrest' })
    ]);
    expect(subtitles.get('a')).toBe('Car Seat Headrest - 2018');
    expect(subtitles.get('b')).toBe('Car Seat Headrest - No year');
  });

  it('adds the year when two cards state the same edition', () => {
    const subtitles = gridSubtitles([
      album({ id: 'a', name: 'Solar Power', version: 'Deluxe Edition', year: 2021 }),
      album({ id: 'b', name: 'Solar Power', version: 'Deluxe Edition', year: 2022 })
    ]);
    expect(subtitles.get('a')).toBe('Lorde - Deluxe Edition - 2021');
    expect(subtitles.get('b')).toBe('Lorde - Deluxe Edition - 2022');
  });

  it('keeps the year a card already draws', () => {
    const subtitles = gridSubtitles(
      [
        album({ id: 'a', name: 'Solar Power', year: 2021 }),
        album({ id: 'b', name: 'Solar Power', year: 2021 })
      ],
      (entry) => String(entry.year ?? '')
    );
    expect(subtitles.get('a')).toBe('2021');
    expect(subtitles.get('b')).toBe('2021');
  });

  it('tells apart two albums by different artists with one title', () => {
    const subtitles = gridSubtitles([
      album({ id: 'a', name: 'Solar Power' }),
      album({ id: 'b', name: 'Solar Power', artist: 'Someone Else' })
    ]);
    expect(subtitles.get('a')).toBe('Lorde');
    expect(subtitles.get('b')).toBe('Someone Else');
  });
});
