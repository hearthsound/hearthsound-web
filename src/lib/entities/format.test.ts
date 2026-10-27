/**
 * Tests for the entity pages' wording: which links an artist page shows and
 * what an album's release details say.
 */
import { describe, expect, it } from 'vitest';

import { albumCardSubtitle, albumTypeLabel, artistLinks, releaseDetails } from './format';

describe('artist links', () => {
  it('labels the kinds a reader knows, in the order the server listed them', () => {
    expect(
      artistLinks([
        { kind: 'wikipedia', url: 'https://en.wikipedia.org/wiki/Radiohead' },
        { kind: 'homepage', url: 'https://radiohead.com' },
        { kind: 'lastfm', url: 'https://last.fm/music/Radiohead' }
      ])
    ).toEqual([
      { label: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Radiohead' },
      { label: 'Website', url: 'https://radiohead.com' },
      { label: 'Last.fm', url: 'https://last.fm/music/Radiohead' }
    ]);
  });

  it('hides a kind it has no label for and a link with no URL', () => {
    expect(
      artistLinks([
        { kind: 'myspace', url: 'https://myspace.com/radiohead' },
        { kind: 'discogs', url: '' }
      ])
    ).toEqual([]);
  });
});

describe('release details', () => {
  it("writes a full release date in the reader's locale", () => {
    const line = releaseDetails({
      releaseDate: '2007-10-10',
      year: 2007,
      albumType: 'album',
      edition: null
    });

    expect(line).toContain('2007');
    expect(line).toContain('Album');
    expect(line).not.toContain('2007 - 2007');
  });

  it('names the type and the edition beside the year', () => {
    expect(
      releaseDetails({
        releaseDate: '1997',
        year: 1997,
        albumType: 'ep',
        edition: 'Deluxe Edition'
      })
    ).toBe('1997 - EP - Deluxe Edition');
  });

  it('omits the parts it does not know', () => {
    expect(releaseDetails({ releaseDate: null, year: null, albumType: null, edition: null })).toBe(
      ''
    );
    expect(
      releaseDetails({ releaseDate: '2001-05', year: 2001, albumType: 'single', edition: null })
    ).toBe('2001 - Single');
  });
});

describe('release types', () => {
  it('labels the types the album page names', () => {
    expect(albumTypeLabel('album')).toBe('Album');
    expect(albumTypeLabel('ep')).toBe('EP');
    expect(albumTypeLabel('single')).toBe('Single');
    expect(albumTypeLabel('compilation')).toBe('Compilation');
    expect(albumTypeLabel('live')).toBe('Live');
    expect(albumTypeLabel('remix')).toBe('Remix');
    expect(albumTypeLabel('soundtrack')).toBe('Soundtrack');
  });

  it('leaves a type it does not name unlabelled', () => {
    expect(albumTypeLabel('demo')).toBeUndefined();
    expect(albumTypeLabel(null)).toBeUndefined();
  });
});

describe('album card subtitles', () => {
  const album = {
    id: 'al_1',
    title: 'Kid A',
    edition: null,
    year: 2000,
    albumType: 'album',
    displayArtist: 'Radiohead',
    artistId: null,
    hasImage: false,
    inLibrary: false
  };

  it('leads with the year', () => {
    expect(albumCardSubtitle(album)).toBe('2000');
  });

  it('names an EP and a single beside the year', () => {
    expect(albumCardSubtitle({ ...album, albumType: 'ep' })).toBe('2000 - EP');
    expect(albumCardSubtitle({ ...album, albumType: 'single' })).toBe('2000 - Single');
  });

  it('says nothing when neither a year nor a named type is known', () => {
    expect(albumCardSubtitle({ ...album, year: null, albumType: 'live' })).toBeUndefined();
  });
});
