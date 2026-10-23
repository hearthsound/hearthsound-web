/**
 * The Home reads: the Recently Added window and the mapping of the Discovery
 * answers into shelves and full lists.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { libraryApi } from '#lib/subsonic/library';
import type { AlbumID3, Playlist } from '#lib/subsonic/types';

import {
  RECENTLY_ADDED_WINDOW_MS,
  generatedPlaylists,
  loadHomePage,
  loadHomeShelves,
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

describe('loadHomeShelves discovery shelves', () => {
  it('fills Recommended Albums with the recommended albums at the shelf size', async () => {
    const recommended = vi
      .spyOn(libraryApi, 'recommendedAlbums')
      .mockResolvedValue([album('al_1', undefined), album('al_2', undefined)]);

    const content = await loadHomeShelves(['recommended-albums'], 20);

    expect(recommended).toHaveBeenCalledWith(20);
    expect(content['recommended-albums']?.albums.map((entry) => entry.id)).toEqual([
      'al_1',
      'al_2'
    ]);
    expect(content['recommended-albums']?.title).toBeUndefined();
  });

  it('names Because You Listen to after the seed artist', async () => {
    vi.spyOn(libraryApi, 'similarArtistAlbums').mockResolvedValue({
      seedArtist: { id: 'ar_1', name: 'Marlowe Fenn' },
      album: [album('al_9', undefined)]
    });

    const content = await loadHomeShelves(['because-you-listen'], 20);

    expect(content['because-you-listen']?.title).toBe('Because You Listen to Marlowe Fenn');
    expect(content['because-you-listen']?.albums.map((entry) => entry.id)).toEqual(['al_9']);
  });

  it('keeps the generic title when the server named no seed artist', async () => {
    vi.spyOn(libraryApi, 'similarArtistAlbums').mockResolvedValue({});

    const content = await loadHomeShelves(['because-you-listen'], 20);

    expect(content['because-you-listen']?.title).toBeUndefined();
    expect(content['because-you-listen']?.albums).toEqual([]);
  });

  it('fills Generated Playlists with the playlists a service generated only', async () => {
    vi.spyOn(libraryApi, 'playlists').mockResolvedValue([
      playlist('weekly', 'ListenBrainz'),
      playlist('mine'),
      playlist('daily', 'Last.fm')
    ]);

    const content = await loadHomeShelves(['generated-playlists'], 20);

    expect(content['generated-playlists']?.playlists.map((entry) => entry.id)).toEqual([
      'weekly',
      'daily'
    ]);
  });

  it('leaves Mood Playlists empty and asks the server nothing for it', async () => {
    const albumsBy = vi.spyOn(libraryApi, 'albumsBy');
    const playlists = vi.spyOn(libraryApi, 'playlists');

    const content = await loadHomeShelves(['mood-playlists'], 20);

    expect(content['mood-playlists']).toEqual({
      albums: [],
      artists: [],
      songs: [],
      playlists: []
    });
    expect(playlists).not.toHaveBeenCalled();
    expect(albumsBy).not.toHaveBeenCalled();
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
