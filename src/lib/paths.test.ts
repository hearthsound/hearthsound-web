/**
 * Tests for the readable-path helpers: which links an answer can build without
 * a request, which of them are refused because a display name is not a path,
 * and what opening an id the server cannot name a page for does.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { toasts } from '#lib/stores/toasts.svelte';
import { libraryApi } from '#lib/subsonic/library';
import type { Child, HearthsoundMember } from '#lib/subsonic/types';

import {
  albumArtistHref,
  albumHref,
  artistHref,
  openById,
  songAlbumHref,
  songArtistHref
} from './paths';

/**
 * Builds the vendor member of an entity.
 *
 * @param path The entity's own readable path, empty when it carries none.
 * @param extra The child segments a track's member carries.
 * @returns The member.
 */
function member(
  path: string,
  extra: Partial<Pick<HearthsoundMember, 'artistPath' | 'albumPath'>> = {}
): HearthsoundMember {
  return {
    availability: 'local',
    inLibrary: false,
    disliked: false,
    origin: 'library',
    path,
    ...extra
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('song links', () => {
  it('opens the artist and the album through the segments the answer carries', () => {
    const song: Child = {
      id: 'so_1',
      artist: 'Alex G',
      album: 'Beach Music',
      hearthsound: member('', { artistPath: 'alex-g-2', albumPath: 'alex-g-2/beach-music' })
    };

    expect(songArtistHref(song)).toBe('/artist/alex-g-2');
    expect(songAlbumHref(song)).toBe('/album/alex-g-2/beach-music');
  });

  it('builds no route out of a display name and an id', () => {
    const song: Child = { id: 'so_1', artist: 'Alex G', album: 'Beach Music', artistId: 'ar_9' };

    expect(songArtistHref(song)).toBeUndefined();
    expect(songAlbumHref(song)).toBeUndefined();
  });

  it('builds no route from a member that carries neither segment', () => {
    const song: Child = {
      id: 'so_1',
      artist: 'Alex G',
      album: 'Beach Music',
      hearthsound: member('')
    };

    expect(songArtistHref(song)).toBeUndefined();
    expect(songAlbumHref(song)).toBeUndefined();
  });
});

describe('card links', () => {
  it('still falls back to the name the payload itself carries', () => {
    expect(artistHref({ name: 'Portishead' })).toBe('/artist/Portishead');
    expect(albumHref({ artist: 'Portishead', name: 'Dummy' })).toBe('/album/Portishead/Dummy');
    expect(artistHref({ name: 'Portishead', hearthsound: member('portishead') })).toBe(
      '/artist/portishead'
    );
  });

  it('opens the artist an album path starts with', () => {
    expect(albumArtistHref({ hearthsound: member('portishead/dummy') })).toBe('/artist/portishead');
  });

  it('opens no artist for an album without a path of two segments', () => {
    expect(albumArtistHref({ name: 'Dummy', artist: 'Portishead' })).toBeUndefined();
    expect(albumArtistHref({ hearthsound: member('portishead') })).toBeUndefined();
    expect(albumArtistHref({ hearthsound: member('/dummy') })).toBeUndefined();
  });
});

describe('opening an id', () => {
  it('reports an answer that names no artist and no album', async () => {
    vi.spyOn(libraryApi, 'resolve').mockResolvedValue({
      type: 'unknown',
      id: 'tr_1',
      path: 'somewhere'
    } as never);
    const push = vi.spyOn(toasts, 'push');
    const go = vi.fn();

    await openById('tr_1', go);

    expect(push).toHaveBeenCalledWith('Could not open this page.', 'error');
    expect(go).not.toHaveBeenCalled();
  });

  it('opens the page of an artist it can name', async () => {
    vi.spyOn(libraryApi, 'resolve').mockResolvedValue({
      type: 'artist',
      id: 'ar_1',
      path: 'portishead'
    } as never);
    const go = vi.fn();

    await openById('ar_1', go);

    expect(go).toHaveBeenCalledWith('/artist/portishead');
  });
});
