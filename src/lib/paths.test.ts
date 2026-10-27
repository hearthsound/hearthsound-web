/**
 * Tests for the entity links: every entity's page is built from its id alone,
 * so two artists of one name and two albums of one title cannot open each
 * other's page.
 */
import { describe, expect, it } from 'vitest';

import { albumHref, artistHref, topSongsHref } from './paths';

describe('artist links', () => {
  it('builds the page from the id', () => {
    expect(artistHref('ar_01H8')).toBe('/artist/ar_01H8');
  });

  it('keeps an id that needs escaping readable and reversible', () => {
    expect(artistHref('ar_a/b')).toBe('/artist/ar_a%2Fb');
  });
});

describe('album links', () => {
  it('builds the page from the id', () => {
    expect(albumHref('al_01H8')).toBe('/album/al_01H8');
  });
});

describe('top songs links', () => {
  it('builds the artist list from the artist id', () => {
    expect(topSongsHref('ar_01H8')).toBe('/artist/ar_01H8/top-songs');
  });
});
