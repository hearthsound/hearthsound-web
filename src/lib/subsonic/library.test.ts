/**
 * Tests for the Subsonic library facade: how an envelope becomes the typed
 * entities the views read, and which answers mean "no such entity".
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SubsonicError, subsonic } from './client';
import {
  bulkMessage,
  listAlbums,
  listAlbumsBy,
  listArtists,
  listPlaylists,
  listRecommendedAlbums,
  listSimilarArtistAlbums,
  listSongs,
  listStarred,
  listTopSongs,
  loadAlbum,
  loadArtist,
  loadArtistInfo,
  loadPlaylist,
  playlistNameProblem,
  removeFromLibrary,
  resolvePath,
  saveToLibrary,
  setFeedback
} from './library';

/**
 * Answers the next Subsonic call with the given envelope payload.
 *
 * @param payload The payload the call should answer with.
 * @returns Nothing.
 */
function answerWith(payload: unknown): void {
  vi.spyOn(subsonic, 'get').mockResolvedValue(payload as never);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('browse reads', () => {
  it('reads the songs of a page', async () => {
    answerWith({ searchResult3: { song: [{ id: 'so_1', title: 'A' }] } });

    expect(await listSongs(1, 60, 60)).toEqual([{ id: 'so_1', title: 'A' }]);
  });

  it('reads the albums of a page in the requested order', async () => {
    answerWith({ albumList2: { album: [{ id: 'al_1', name: 'Record' }] } });

    expect(await listAlbums(1, 0, 60)).toEqual([{ id: 'al_1', name: 'Record' }]);
    expect(await listAlbumsBy('newest', 1, 20, 10)).toEqual([{ id: 'al_1', name: 'Record' }]);
  });

  it('joins the artist index into one list', async () => {
    answerWith({
      artists: {
        index: [
          { name: 'A', artist: [{ id: 'ar_1', name: 'A' }] },
          { artist: [{ id: 'ar_2', name: 'B' }] }
        ]
      }
    });

    expect(await listArtists(1)).toEqual([
      { id: 'ar_1', name: 'A' },
      { id: 'ar_2', name: 'B' }
    ]);
  });

  it('reads liked entities and playlists, with an empty answer as empty', async () => {
    answerWith({ starred2: { song: [{ id: 'so_1' }] } });
    expect(await listStarred()).toEqual({ song: [{ id: 'so_1' }] });

    answerWith({});
    expect(await listStarred()).toEqual({});

    answerWith({ playlists: { playlist: [{ id: 'pl_1', name: 'Mix' }] } });
    expect(await listPlaylists()).toEqual([{ id: 'pl_1', name: 'Mix' }]);
  });

  it('reads an artist biography only when one was reported', async () => {
    answerWith({ artistInfo2: { biography: 'A life.' } });
    expect(await loadArtistInfo('ar_1')).toEqual({ biography: 'A life.' });

    answerWith({ artistInfo2: {} });
    expect(await loadArtistInfo('ar_1')).toBeNull();
  });

  it('reads an artist top songs list', async () => {
    answerWith({ topSongs: { song: [{ id: 'so_1' }] } });

    expect(await listTopSongs('ar_1', 5)).toEqual([{ id: 'so_1' }]);
  });

  it('reads the recommended and similar-artist albums, with an empty answer as empty', async () => {
    answerWith({ recommendedAlbums: { album: [{ id: 'al_1', name: 'Record' }] } });
    expect(await listRecommendedAlbums(20)).toEqual([{ id: 'al_1', name: 'Record' }]);

    answerWith({
      similarArtistAlbums: {
        seedArtist: { id: 'ar_1', name: 'Marlowe Fenn' },
        album: [{ id: 'al_2', name: 'Next' }]
      }
    });
    expect(await listSimilarArtistAlbums(20)).toEqual({
      seedArtist: { id: 'ar_1', name: 'Marlowe Fenn' },
      album: [{ id: 'al_2', name: 'Next' }]
    });

    answerWith({});
    expect(await listRecommendedAlbums(20)).toEqual([]);
    expect(await listSimilarArtistAlbums(20)).toEqual({});
  });
});

describe('detail reads', () => {
  it('reads one album, artist and playlist with their entries', async () => {
    answerWith({ album: { id: 'al_1', name: 'Record', song: [{ id: 'so_1' }] } });
    expect(await loadAlbum('al_1')).toMatchObject({ id: 'al_1', song: [{ id: 'so_1' }] });

    answerWith({ artist: { id: 'ar_1', name: 'Band', album: [{ id: 'al_1', name: 'Record' }] } });
    expect(await loadArtist('ar_1')).toMatchObject({ id: 'ar_1', name: 'Band' });

    answerWith({ playlist: { id: 'pl_1', name: 'Mix', entry: [{ id: 'so_1' }] } });
    expect(await loadPlaylist('pl_1')).toMatchObject({ id: 'pl_1', entry: [{ id: 'so_1' }] });
  });

  it('answers nothing when the envelope carries no entity', async () => {
    answerWith({});

    expect(await loadAlbum('al_missing')).toBeNull();
    expect(await loadArtist('ar_missing')).toBeNull();
    expect(await loadPlaylist('pl_missing')).toBeNull();
  });

  it('answers nothing when the server reports the entity as not found', async () => {
    vi.spyOn(subsonic, 'get').mockRejectedValue(
      new SubsonicError({ code: 70, message: 'The requested data was not found.' })
    );

    expect(await loadAlbum('al_missing')).toBeNull();
    expect(await loadArtist('ar_missing')).toBeNull();
    expect(await loadPlaylist('pl_missing')).toBeNull();
  });

  it('lets any other failure through', async () => {
    vi.spyOn(subsonic, 'get').mockRejectedValue(new Error('the server did not answer'));

    await expect(loadAlbum('al_1')).rejects.toThrow('the server did not answer');
  });
});

describe('readable paths', () => {
  it('resolves the artist and the album a path names', async () => {
    answerWith({ resolved: { type: 'artist', id: 'ar_1', path: 'portishead' } });
    expect(await resolvePath({ artist: 'portishead' })).toEqual({
      type: 'artist',
      id: 'ar_1',
      path: 'portishead'
    });

    answerWith({ resolved: { type: 'album', id: 'al_1', path: 'portishead/dummy' } });
    expect(await resolvePath({ artist: 'portishead', album: 'dummy' })).toEqual({
      type: 'album',
      id: 'al_1',
      path: 'portishead/dummy'
    });
  });

  it('answers nothing for a path that names neither an artist nor an album', async () => {
    answerWith({ resolved: { type: 'unknown', id: 'tr_1', path: 'somewhere' } });

    expect(await resolvePath({ id: 'tr_1' })).toBeNull();
  });
});

describe('bulk writes', () => {
  it('reads the ids the server did not apply', async () => {
    const post = vi.spyOn(subsonic, 'post').mockResolvedValue({
      bulkResult: { applied: ['tr_1', 'tr_2'], failed: [{ id: 'tr_3', reason: 'not found' }] }
    } as never);

    expect(await setFeedback(['tr_1', 'tr_2', 'tr_3'], 'like')).toEqual({
      applied: ['tr_1', 'tr_2'],
      failed: [{ id: 'tr_3', reason: 'not found' }]
    });
    expect(post).toHaveBeenCalledWith('hsSetFeedback', {
      id: ['tr_1', 'tr_2', 'tr_3'],
      value: 'like'
    });
  });

  it('treats a server without the member as having applied everything', async () => {
    vi.spyOn(subsonic, 'post').mockResolvedValue({} as never);

    expect(await saveToLibrary(['al_1'])).toEqual({ applied: ['al_1'], failed: [] });
    expect(await removeFromLibrary(['al_1', 'al_2'])).toEqual({
      applied: ['al_1', 'al_2'],
      failed: []
    });
  });

  it('says how many ids a partial write took, and nothing when all were taken', async () => {
    expect(
      bulkMessage('Liked', { applied: ['tr_1', 'tr_2'], failed: [{ id: 'tr_3', reason: 'x' }] }, 3)
    ).toBe('Liked 2 of 3');
    expect(bulkMessage('Saved', { applied: ['al_1'], failed: [] }, 1)).toBeNull();
  });
});

describe('playlist names', () => {
  it('accepts a name of at most 255 bytes', () => {
    expect(playlistNameProblem('a'.repeat(255))).toBeNull();
    expect(playlistNameProblem('  Road Trip  ')).toBeNull();
    expect(playlistNameProblem(`  ${'a'.repeat(255)}  `)).toBeNull();
  });

  it('asks for a name when the field is empty or only spaces', () => {
    expect(playlistNameProblem('')).toBe('A playlist name is required.');
    expect(playlistNameProblem('   ')).toBe('A playlist name is required.');
  });

  it('refuses what the server counts past the byte limit', () => {
    expect(playlistNameProblem('a'.repeat(256))).toBe('A playlist name is at most 255 characters.');
    // 255 accented letters are 510 bytes, which the server counts as too long.
    expect(playlistNameProblem('\u00e9'.repeat(255))).toBe(
      'A playlist name is at most 255 characters.'
    );
  });
});
