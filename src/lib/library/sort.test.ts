/**
 * Tests for the library lists' orders and the address that keeps the reader's
 * choice: which server order a menu order asks for, and what an address means.
 */
import { describe, expect, it } from 'vitest';

import {
  ALBUM_SORTS,
  ARTIST_SORTS,
  DEFAULT_ARTIST_SORT,
  DEFAULT_SONG_SORT,
  SONG_SORTS,
  artistRoute,
  readArtistQuery,
  readSongQuery,
  songRoute,
  DEFAULT_ALBUM_SORT,
  albumListType,
  albumListTypeOf,
  albumNarrow,
  albumRoute,
  albumSortId,
  readAlbumQuery
} from './sort';

describe('album orders', () => {
  it('reads back the menu order it maps a list order to', () => {
    for (const option of ALBUM_SORTS) {
      expect(albumSortId(albumListType(option.id))).toBe(option.id);
    }
  });

  it('asks the server for the order the reader chose', () => {
    expect(albumListType('name')).toBe('alphabeticalByName');
    expect(albumListType('artist')).toBe('alphabeticalByArtist');
    expect(albumListType('recent')).toBe('recent');
    expect(albumListType('random')).toBe('random');
  });

  it('shows no menu order for a list order the menu cannot offer', () => {
    expect(albumSortId('byYear')).toBeUndefined();
    expect(albumSortId('byGenre')).toBeUndefined();
  });

  it('reads a genre as the genre order, which is the only order that takes one', () => {
    expect(albumListTypeOf({ sort: 'recent', genre: 'Rock' })).toBe('byGenre');
    expect(albumListTypeOf({ sort: 'recent', genre: undefined })).toBe('recent');
  });

  it('narrows a read only when a genre is chosen', () => {
    expect(albumNarrow({ sort: 'name', genre: 'Jazz' })).toEqual({ genre: 'Jazz' });
    expect(albumNarrow({ sort: 'name', genre: undefined })).toEqual({});
  });
});

describe('the album list address', () => {
  it('reads the order and the genre it carries', () => {
    expect(readAlbumQuery('?sort=newest&genre=Rock')).toEqual({ sort: 'newest', genre: 'Rock' });
  });

  it('writes a choice the reader gets back unchanged', () => {
    expect(albumRoute({ sort: 'newest', genre: 'Rock' })).toBe(
      '/library/albums?sort=newest&genre=Rock'
    );
    const route = albumRoute({ sort: 'frequent', genre: 'Jazz' });
    expect(readAlbumQuery(route.slice(route.indexOf('?')))).toEqual({
      sort: 'frequent',
      genre: 'Jazz'
    });
  });

  it('shows the default order for an order it does not know', () => {
    expect(readAlbumQuery('?sort=sideways')).toEqual({
      sort: DEFAULT_ALBUM_SORT,
      genre: undefined
    });
    expect(readAlbumQuery('')).toEqual({ sort: DEFAULT_ALBUM_SORT, genre: undefined });
  });

  it('leaves a cleared genre out of the address', () => {
    expect(albumRoute({ sort: DEFAULT_ALBUM_SORT, genre: undefined })).toBe('/library/albums');
    expect(albumRoute({ sort: DEFAULT_ALBUM_SORT, genre: '' })).toBe('/library/albums');
    expect(readAlbumQuery('?genre=')).toEqual({ sort: DEFAULT_ALBUM_SORT, genre: undefined });
    expect(readAlbumQuery('?genre=Rock')).toEqual({ sort: DEFAULT_ALBUM_SORT, genre: 'Rock' });
  });
});

describe('song orders', () => {
  it('offers the six orders the server reads', () => {
    expect(SONG_SORTS.map((option) => option.id)).toEqual([
      'title',
      'artist',
      'album',
      'added',
      'played',
      'year'
    ]);
    expect(DEFAULT_SONG_SORT).toBe('title');
  });

  it('reads an unknown or absent order as the default', () => {
    expect(readSongQuery('')).toBe('title');
    expect(readSongQuery('?sort=played')).toBe('played');
    expect(readSongQuery('?sort=random')).toBe('title');
  });

  it('writes the order into the address, leaving the default out', () => {
    expect(songRoute('title')).toBe('/library/songs');
    expect(songRoute('added')).toBe('/library/songs?sort=added');
  });
});

describe('artist orders', () => {
  it('offers the three orders the server reads', () => {
    expect(ARTIST_SORTS.map((option) => option.id)).toEqual(['name', 'added', 'played']);
    expect(DEFAULT_ARTIST_SORT).toBe('name');
  });

  it('reads and writes the order in the address', () => {
    expect(readArtistQuery('')).toBe('name');
    expect(readArtistQuery('?sort=played')).toBe('played');
    expect(readArtistQuery('?sort=title')).toBe('name');
    expect(artistRoute('name')).toBe('/library/artists');
    expect(artistRoute('added')).toBe('/library/artists?sort=added');
  });
});
