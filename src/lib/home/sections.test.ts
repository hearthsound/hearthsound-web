/**
 * Tests for the Home section registry: the invariants the shelves, the full
 * list pages and the Customize Home dialog rely on.
 */
import { describe, expect, it } from 'vitest';

import {
  DEFAULT_HOME_ORDER,
  HOME_DISCOVERY_NOTE,
  HOME_SECTION_BY_ID,
  HOME_SECTIONS,
  discoverySectionIds
} from './sections';

describe('home sections', () => {
  it('gives every section a unique route segment', () => {
    const ids = HOME_SECTIONS.map((section) => section.id);

    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
    }
  });

  it('indexes every section by its id', () => {
    expect(Object.keys(HOME_SECTION_BY_ID)).toEqual(HOME_SECTIONS.map((section) => section.id));
    for (const section of HOME_SECTIONS) {
      expect(HOME_SECTION_BY_ID[section.id]).toBe(section);
    }
  });

  it('keeps the declared order as the default layout order', () => {
    expect(DEFAULT_HOME_ORDER).toEqual(HOME_SECTIONS.map((section) => section.id));
  });

  it('titles every section and gives it a known item shape', () => {
    for (const section of HOME_SECTIONS) {
      expect(section.title.trim()).not.toBe('');
      expect(['album', 'artist', 'playlist', 'song']).toContain(section.kind);
    }
  });

  it('shows the first eight sections to a browser with nothing stored', () => {
    expect(HOME_SECTIONS.filter((section) => section.defaultOn)).toHaveLength(8);
    expect(HOME_SECTIONS.slice(0, 8).every((section) => section.defaultOn)).toBe(true);
    expect(HOME_SECTIONS.slice(8).every((section) => !section.defaultOn)).toBe(true);
  });

  it('marks the four Discovery sections that wait for their data source', () => {
    const discovery = HOME_SECTIONS.filter((section) => section.discovery).map(
      (section) => section.id
    );

    expect(discovery).toEqual([
      'recommended-albums',
      'because-you-listen',
      'generated-playlists',
      'mood-playlists'
    ]);
    expect(HOME_DISCOVERY_NOTE).not.toBe('');
  });

  it('picks only the Discovery sections out of a layout', () => {
    expect(discoverySectionIds(DEFAULT_HOME_ORDER)).toEqual(
      HOME_SECTIONS.filter((section) => section.discovery).map((section) => section.id)
    );
    expect(discoverySectionIds(['recently-played', 'random-albums', 'random-songs'])).toEqual([]);
    expect(discoverySectionIds(['unknown-section'])).toEqual([]);
  });
});
