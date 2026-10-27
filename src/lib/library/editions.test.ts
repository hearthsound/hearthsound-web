/**
 * Tests for the album card's name and subtitle: the edition label a listing adds
 * when it holds two releases of one name, and the year a grid adds when two cards
 * would still look identical.
 */
import { describe, expect, it } from 'vitest';

import { albumLabels, albumSubtitle } from '#lib/library/editions';
import type { AlbumID3 } from '#lib/subsonic/types';

/** Builds an album with the fields a card reads. */
function album(fields: Partial<AlbumID3> & Pick<AlbumID3, 'id' | 'name'>): AlbumID3 {
  return { artist: 'Lorde', ...fields };
}

describe('albumSubtitle', () => {
  it('names the artist alone', () => {
    expect(albumSubtitle(album({ id: 'a', name: 'Solar Power' }))).toBe('Lorde');
  });

  it('never moves the edition onto the artist', () => {
    expect(albumSubtitle(album({ id: 'a', name: 'Solar Power', version: 'Deluxe Edition' }))).toBe(
      'Lorde'
    );
  });

  it('draws nothing when no artist is known', () => {
    expect(albumSubtitle(album({ id: 'a', name: 'Solar Power', artist: undefined }))).toBe(
      undefined
    );
    expect(albumSubtitle(album({ id: 'a', name: 'Solar Power', artist: '' }))).toBe(undefined);
  });
});

describe('albumLabels', () => {
  it('leaves one album with an edition label on its plain name', () => {
    const labels = albumLabels([
      album({ id: 'a', name: 'Solar Power', version: 'Deluxe Edition' }),
      album({ id: 'b', name: 'Melodrama' })
    ]);
    expect(labels.titles.get('a')).toBe('Solar Power');
    expect(labels.titles.get('b')).toBe('Melodrama');
    expect(labels.subtitles.get('a')).toBe('Lorde');
  });

  it('appends each edition in parentheses when two releases share the name', () => {
    const labels = albumLabels([
      album({ id: 'a', name: 'Solar Power', version: 'Deluxe Edition' }),
      album({ id: 'b', name: 'Solar Power' })
    ]);
    expect(labels.titles.get('a')).toBe('Solar Power (Deluxe Edition)');
    expect(labels.titles.get('b')).toBe('Solar Power');
    expect(labels.subtitles.get('a')).toBe('Lorde');
    expect(labels.subtitles.get('b')).toBe('Lorde');
  });

  it('does not treat two artists one title as one album', () => {
    const labels = albumLabels([
      album({ id: 'a', name: 'Greatest Hits', version: 'Deluxe Edition' }),
      album({ id: 'b', name: 'Greatest Hits', artist: 'ABBA' })
    ]);
    expect(labels.titles.get('a')).toBe('Greatest Hits');
    expect(labels.titles.get('b')).toBe('Greatest Hits');
  });

  it('adds the year when neither card states an edition', () => {
    const labels = albumLabels([
      album({ id: 'a', name: 'Twin Fantasy (Face to Face)', year: 2018 }),
      album({ id: 'b', name: 'Twin Fantasy (Face to Face)' })
    ]);
    expect(labels.titles.get('a')).toBe('Twin Fantasy (Face to Face)');
    expect(labels.subtitles.get('a')).toBe('Lorde - 2018');
    expect(labels.subtitles.get('b')).toBe('Lorde - No year');
  });

  it('adds the year when two cards state the same edition', () => {
    const labels = albumLabels([
      album({ id: 'a', name: 'Solar Power', version: 'Deluxe Edition', year: 2021 }),
      album({ id: 'b', name: 'Solar Power', version: 'Deluxe Edition', year: 2022 })
    ]);
    expect(labels.titles.get('a')).toBe('Solar Power (Deluxe Edition)');
    expect(labels.subtitles.get('a')).toBe('Lorde - 2021');
    expect(labels.subtitles.get('b')).toBe('Lorde - 2022');
  });

  it('keeps the year a caller already draws', () => {
    const labels = albumLabels(
      [
        album({ id: 'a', name: 'Twin Fantasy (Face to Face)', year: 2018 }),
        album({ id: 'b', name: 'Twin Fantasy (Face to Face)' })
      ],
      (entry) => (entry.year === undefined ? 'No year' : String(entry.year))
    );
    expect(labels.subtitles.get('a')).toBe('2018');
    expect(labels.subtitles.get('b')).toBe('No year');
  });
});
