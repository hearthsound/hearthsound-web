/**
 * The Recently Added window.
 *
 * The `newest` album order answers with the whole library, so Home keeps the
 * week's arrivals and drops anything older (p07).
 */
import { describe, expect, it } from 'vitest';

import type { AlbumID3 } from '#lib/subsonic/types';

import { RECENTLY_ADDED_WINDOW_MS, withinRecentlyAddedWindow } from './data';

/** One album created at an ISO timestamp. */
function album(id: string, created: string | undefined): AlbumID3 {
  return { id, name: id, created } as AlbumID3;
}

const NOW = Date.parse('2026-10-21T12:00:00.000Z');

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
