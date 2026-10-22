/**
 * Tests for the shell's route registry: which pages draw their own header and
 * with it the phone drawer command.
 */
import { describe, expect, it } from 'vitest';

import { HOME_SECTIONS } from './home/sections';
import { LIBRARY_KINDS } from './library/kinds';
import { adminSections } from './nav';
import { routeMetadata } from './routes';

/** Whether the shell leaves its phone bar out for a path. */
function ownsHeader(path: string): boolean {
  return routeMetadata(path).ownsHeader;
}

describe('shell route registry', () => {
  it('gives every library view its own header', () => {
    for (const kind of LIBRARY_KINDS) {
      expect(ownsHeader(`/library/${kind}`)).toBe(true);
    }
    expect(ownsHeader('/liked/albums')).toBe(true);
    expect(ownsHeader('/liked/artists')).toBe(true);
  });

  it('gives every administration area but the overview its own header', () => {
    const areas = adminSections
      .flatMap((section) => section.entries)
      .filter((entry) => entry.href !== '/admin');

    expect(areas.length).toBeGreaterThan(0);
    for (const area of areas) {
      expect(ownsHeader(area.href)).toBe(true);
    }
    expect(ownsHeader('/admin')).toBe(false);
  });

  it('gives the home page, its sections and the detail pages their own header', () => {
    expect(ownsHeader('/')).toBe(true);
    for (const section of HOME_SECTIONS) {
      expect(ownsHeader(`/home/${section.id}`)).toBe(true);
    }
    for (const path of [
      '/search',
      '/search/albums',
      '/album/al-1',
      '/artist/ar-1',
      '/playlist/pl-1'
    ]) {
      expect(ownsHeader(path)).toBe(true);
    }
  });

  it('leaves the shell phone bar on every other page', () => {
    for (const path of [
      '/login',
      '/setup',
      '/queue',
      '/library',
      '/library/genres',
      '/home/nothing',
      '/admin/unknown',
      '/album',
      '/searching'
    ]) {
      expect(ownsHeader(path)).toBe(false);
    }
  });
});
