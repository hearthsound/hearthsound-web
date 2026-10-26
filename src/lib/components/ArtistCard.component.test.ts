/**
 * Tests for the artist card: the library mark a listing of mixed members and
 * catalog names asks for, and the online picture and album count a catalog
 * artist's card carries.
 */
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { membership } from '#lib/library/membership.svelte';
import type { ArtistID3 } from '#lib/subsonic/types';

// The cover box paints a picture this session already holds at once, which is
// what makes the URL it asks the server for readable here.
const covers = vi.hoisted(() => ({
  isLoaded: vi.fn(() => true),
  isFailed: vi.fn(() => false),
  load: vi.fn(),
  reportFailure: vi.fn()
}));

vi.mock('#lib/ui/image-loader', () => ({ imageLoader: covers }));

import ArtistCard from './ArtistCard.svelte';

/** An artist the server reported inside the caller's library. */
const saved: ArtistID3 = {
  id: 'ar_1',
  name: 'Marlowe Fenn',
  hearthsound: { availability: 'local', inLibrary: true, disliked: false, origin: 'library' }
};

/** An artist the server reported outside the caller's library. */
const catalog: ArtistID3 = {
  id: 'ar_2',
  name: 'Marlowe Fenn',
  hearthsound: { availability: 'remote', inLibrary: false, disliked: false, origin: 'catalog' }
};

afterEach(() => {
  cleanup();
  membership.reset();
});

describe('an artist card', () => {
  it('marks an artist the library holds when the listing asks for the mark', () => {
    const { getByRole } = render(ArtistCard, { props: { artist: saved, libraryMark: true } });

    expect(getByRole('img', { name: 'In your library' })).toBeTruthy();
  });

  it('names the mark in the link a screen reader reads', () => {
    const { getByRole } = render(ArtistCard, { props: { artist: saved, libraryMark: true } });

    expect(getByRole('link', { name: 'Marlowe Fenn, in your library' })).toBeTruthy();
  });

  it('draws no mark when the listing holds only library members', () => {
    const { container, getByRole } = render(ArtistCard, { props: { artist: saved } });

    expect(container.querySelector('.hs-card__library-mark')).toBeNull();
    expect(getByRole('link', { name: 'Marlowe Fenn' })).toBeTruthy();
  });

  it('draws no mark for an artist the library does not hold', () => {
    const { container } = render(ArtistCard, { props: { artist: catalog, libraryMark: true } });

    expect(container.querySelector('.hs-card__library-mark')).toBeNull();
  });
});

describe('a catalog artist card', () => {
  it('fetches the online picture through the cover route', () => {
    const { container } = render(ArtistCard, {
      props: { artist: { ...catalog, id: 'x_deezer_ar_27', coverArt: 'x_deezer_ar_27' } }
    });

    const image = container.querySelector('img');
    expect(image?.getAttribute('src')).toContain('getCoverArt');
    expect(image?.getAttribute('src')).toContain('x_deezer_ar_27');
  });

  it('counts the albums it knows about', () => {
    const { getByText, rerender } = render(ArtistCard, {
      props: { artist: { ...catalog, albumCount: 38 }, showAlbumCount: true }
    });
    expect(getByText('38 albums')).toBeTruthy();

    rerender({ artist: { ...catalog, albumCount: 1 }, showAlbumCount: true });
    expect(getByText('1 album')).toBeTruthy();
  });

  it('draws no count for an unknown or empty one', () => {
    const { container, rerender } = render(ArtistCard, {
      props: { artist: { ...catalog, albumCount: 0 }, showAlbumCount: true }
    });
    expect(container.querySelector('.album-count')).toBeNull();

    rerender({ artist: catalog, showAlbumCount: true });
    expect(container.querySelector('.album-count')).toBeNull();
  });

  it('draws no count when the listing does not ask for one', () => {
    const { container } = render(ArtistCard, {
      props: { artist: { ...catalog, albumCount: 38 } }
    });

    expect(container.querySelector('.album-count')).toBeNull();
  });
});
