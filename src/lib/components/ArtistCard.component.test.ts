/**
 * Tests for the artist card's library mark: a listing that can hold both
 * library members and catalog names asks for the mark, and only an artist the
 * library actually holds gets one.
 */
import { cleanup, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it } from 'vitest';

import { membership } from '#lib/library/membership.svelte';
import type { ArtistID3 } from '#lib/subsonic/types';

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
