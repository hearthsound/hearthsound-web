/**
 * The Home reads: the Recently Added window and the mapping of the Discovery
 * answers into shelves and full lists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { libraryApi } from '#lib/subsonic/library';
import type { AlbumID3, Playlist } from '#lib/subsonic/types';

import {
  RECENTLY_ADDED_WINDOW_MS,
  createHomeShelfReader,
  generatedPlaylists,
  loadHomePage,
  withinRecentlyAddedWindow
} from './data';

/** One album created at an ISO timestamp. */
function album(id: string, created: string | undefined): AlbumID3 {
  return { id, name: id, created } as AlbumID3;
}

/** One playlist with the server's lifetime member. */
function playlist(id: string, generatedBy?: string): Playlist {
  return {
    id,
    name: id,
    songCount: 3,
    hearthsound: generatedBy === undefined ? { temporary: false } : { temporary: true, generatedBy }
  };
}

const NOW = Date.parse('2026-10-21T12:00:00.000Z');

afterEach(() => {
  vi.restoreAllMocks();
});

describe('withinRecentlyAddedWindow', () => {
  it('keeps albums from the last seven days and drops older ones', () => {
    const kept = withinRecentlyAddedWindow(
      [
        album('today', '2026-10-21T08:00:00.000Z'),
        album('six-days', '2026-10-15T12:00:00.000Z'),
        album('eight-days', '2026-10-13T11:00:00.000Z')
      ],
      NOW
    );
    expect(kept.map((entry) => entry.id)).toEqual(['today', 'six-days']);
  });

  it('keeps an album exactly at the edge of the window', () => {
    const edge = new Date(NOW - RECENTLY_ADDED_WINDOW_MS).toISOString();
    expect(withinRecentlyAddedWindow([album('edge', edge)], NOW)).toHaveLength(1);
  });

  it('drops albums without a readable timestamp', () => {
    expect(
      withinRecentlyAddedWindow([album('none', undefined), album('bad', 'yesterday')], NOW)
    ).toEqual([]);
  });
});

describe('generatedPlaylists', () => {
  it('keeps the playlists a listening service generated', () => {
    expect(generatedPlaylists([playlist('weekly', 'ListenBrainz'), playlist('mine')])).toEqual([
      playlist('weekly', 'ListenBrainz')
    ]);
  });

  it('keeps nothing when the server generated none', () => {
    expect(generatedPlaylists([])).toEqual([]);
    expect(generatedPlaylists([playlist('mine')])).toEqual([]);
  });
});

describe('the Home shelf reader', () => {
  it('fills Recommended Albums with the recommended albums at the shelf size', async () => {
    const recommended = vi
      .spyOn(libraryApi, 'recommendedAlbums')
      .mockResolvedValue([album('al_1', undefined), album('al_2', undefined)]);

    const content = await createHomeShelfReader(20)('recommended-albums');

    expect(recommended).toHaveBeenCalledWith(20);
    expect(content.albums.map((entry) => entry.id)).toEqual(['al_1', 'al_2']);
    expect(content.title).toBeUndefined();
  });

  it('names Because You Listen to after the seed artist', async () => {
    vi.spyOn(libraryApi, 'similarArtistAlbums').mockResolvedValue({
      seedArtist: { id: 'ar_1', name: 'Marlowe Fenn' },
      album: [album('al_9', undefined)]
    });

    const content = await createHomeShelfReader(20)('because-you-listen');

    expect(content.title).toBe('Because You Listen to Marlowe Fenn');
    expect(content.albums.map((entry) => entry.id)).toEqual(['al_9']);
  });

  it('keeps the generic title when the server named no seed artist', async () => {
    vi.spyOn(libraryApi, 'similarArtistAlbums').mockResolvedValue({});

    const content = await createHomeShelfReader(20)('because-you-listen');

    expect(content.title).toBeUndefined();
    expect(content.albums).toEqual([]);
  });

  it('fills Generated Playlists with the playlists a service generated only', async () => {
    vi.spyOn(libraryApi, 'playlists').mockResolvedValue([
      playlist('weekly', 'ListenBrainz'),
      playlist('mine'),
      playlist('daily', 'Last.fm')
    ]);

    const content = await createHomeShelfReader(20)('generated-playlists');

    expect(content.playlists.map((entry) => entry.id)).toEqual(['weekly', 'daily']);
  });

  it('leaves Mood Playlists empty and asks the server nothing for it', async () => {
    const albumsBy = vi.spyOn(libraryApi, 'albumsBy');
    const playlists = vi.spyOn(libraryApi, 'playlists');

    const content = await createHomeShelfReader(20)('mood-playlists');

    expect(content).toEqual({ albums: [], artists: [], songs: [], playlists: [] });
    expect(playlists).not.toHaveBeenCalled();
    expect(albumsBy).not.toHaveBeenCalled();
  });

  it('reads the liked entities once for the three Liked shelves', async () => {
    const starred = vi.spyOn(libraryApi, 'starred').mockResolvedValue({
      album: [album('al_1', undefined)],
      artist: [{ id: 'ar_1', name: 'Marlowe Fenn' }],
      song: [{ id: 'tr_1', title: 'A Song' }]
    } as never);
    const read = createHomeShelfReader(20);

    expect((await read('liked-albums')).albums.map((entry) => entry.id)).toEqual(['al_1']);
    expect((await read('liked-artists')).artists.map((entry) => entry.id)).toEqual(['ar_1']);
    expect((await read('liked-songs')).songs.map((entry) => entry.id)).toEqual(['tr_1']);
    expect(starred).toHaveBeenCalledTimes(1);
  });

  it('answers a shelf without waiting for a slower one', async () => {
    const slow = Promise.withResolvers<AlbumID3[]>();
    vi.spyOn(libraryApi, 'recommendedAlbums').mockReturnValue(slow.promise);
    vi.spyOn(libraryApi, 'albumsBy').mockResolvedValue([album('al_1', new Date().toISOString())]);
    const read = createHomeShelfReader(20);

    const recommended = read('recommended-albums');
    const recent = await read('recently-added');

    expect(recent.albums.map((entry) => entry.id)).toEqual(['al_1']);
    slow.resolve([]);
    await expect(recommended).resolves.toMatchObject({ albums: [] });
  });
});

describe('loadHomePage album cursors', () => {
  /** An album created a number of days before now. */
  function addedDaysAgo(id: string, days: number): AlbumID3 {
    return album(id, new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());
  }

  it('stops on a full page that is entirely older than the window', async () => {
    const albumsBy = vi
      .spyOn(libraryApi, 'albumsBy')
      .mockResolvedValue([addedDaysAgo('al_1', 20), addedDaysAgo('al_2', 30)]);

    const page = await loadHomePage('recently-added', 0, 2);

    expect(albumsBy).toHaveBeenCalledWith('newest', 1, 0, 2);
    expect(page.albums).toEqual([]);
    expect(page.next).toBeNull();
  });

  it('offers the next page while a full page holds one album of the week', async () => {
    vi.spyOn(libraryApi, 'albumsBy').mockResolvedValue([
      addedDaysAgo('al_1', 1),
      addedDaysAgo('al_2', 30)
    ]);

    const page = await loadHomePage('recently-added', 0, 2);

    expect(page.albums.map((entry) => entry.id)).toEqual(['al_1']);
    expect(page.next).toBe(2);
  });

  it('ends the Recently Added list on a short page', async () => {
    vi.spyOn(libraryApi, 'albumsBy').mockResolvedValue([addedDaysAgo('al_1', 1)]);

    const page = await loadHomePage('recently-added', 0, 2);

    expect(page.albums.map((entry) => entry.id)).toEqual(['al_1']);
    expect(page.next).toBeNull();
  });

  it('keeps paging a full page of a section that is not Recently Added', async () => {
    vi.spyOn(libraryApi, 'albumsBy').mockResolvedValue([
      addedDaysAgo('al_1', 20),
      addedDaysAgo('al_2', 30)
    ]);

    const page = await loadHomePage('most-played', 20, 2);

    expect(page.albums.map((entry) => entry.id)).toEqual(['al_1', 'al_2']);
    expect(page.next).toBe(22);
  });
});

describe('loadHomePage discovery lists', () => {
  it('asks Recommended Albums for a hundred and answers in one page', async () => {
    const recommended = vi
      .spyOn(libraryApi, 'recommendedAlbums')
      .mockResolvedValue([album('al_1', undefined)]);

    const page = await loadHomePage('recommended-albums', 0, 60);

    expect(recommended).toHaveBeenCalledWith(100);
    expect(page.albums.map((entry) => entry.id)).toEqual(['al_1']);
    expect(page.next).toBeNull();
  });

  it('asks Because You Listen to for a hundred and keeps the seed title', async () => {
    const similar = vi.spyOn(libraryApi, 'similarArtistAlbums').mockResolvedValue({
      seedArtist: { id: 'ar_1', name: 'Marlowe Fenn' },
      album: [album('al_9', undefined)]
    });

    const page = await loadHomePage('because-you-listen', 0, 60);

    expect(similar).toHaveBeenCalledWith(100);
    expect(page.title).toBe('Because You Listen to Marlowe Fenn');
    expect(page.albums.map((entry) => entry.id)).toEqual(['al_9']);
  });

  it('lists the generated playlists and finishes on the first page', async () => {
    const playlists = vi
      .spyOn(libraryApi, 'playlists')
      .mockResolvedValue([playlist('weekly', 'ListenBrainz'), playlist('mine')]);

    const page = await loadHomePage('generated-playlists', 0, 60);

    expect(playlists).toHaveBeenCalledTimes(1);
    expect(page.playlists.map((entry) => entry.id)).toEqual(['weekly']);
    expect(page.next).toBeNull();
  });

  it('answers Mood Playlists and later Discovery pages with nothing', async () => {
    const recommended = vi.spyOn(libraryApi, 'recommendedAlbums');

    expect(await loadHomePage('mood-playlists', 0, 60)).toMatchObject({
      albums: [],
      playlists: [],
      next: null
    });
    expect(await loadHomePage('recommended-albums', 60, 60)).toMatchObject({
      albums: [],
      next: null
    });
    expect(recommended).not.toHaveBeenCalled();
  });
});
