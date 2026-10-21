/**
 * Tests for the Home layout: what a stored answer is allowed to say, which
 * sections a missing or unknown id adds or drops, and what each change writes
 * back.
 */
import { describe, expect, it } from 'vitest';

import { DEFAULT_HOME_ORDER } from './sections';
import { HOME_STORAGE_KEY, HomeLayoutStore, parseHomeLayout } from './layout.svelte';

/** The five sections the p07 defaults leave off. */
const OFF_BY_DEFAULT = [
  'most-played',
  'highest-rated',
  'random-albums',
  'liked-songs',
  'random-songs'
];

/** An in-memory stand-in for `localStorage`. */
function memoryStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value)
  };
}

describe('home layout', () => {
  it('uses the default order when nothing or something unreadable is stored', () => {
    for (const raw of [null, 'not json', '[]', '{"v":2,"order":5}']) {
      const layout = parseHomeLayout(raw);
      expect(layout.order).toEqual([...DEFAULT_HOME_ORDER]);
      expect(layout.hidden).toEqual(OFF_BY_DEFAULT);
    }
  });

  it('keeps a stored order, drops unknown ids and appends missing sections', () => {
    const layout = parseHomeLayout(
      '{"v":1,"order":["random-songs","gone","recently-added","random-songs"],' +
        '"hidden":["mood-playlists","gone"]}'
    );
    expect(layout.order.slice(0, 3)).toEqual(['random-songs', 'recently-added', 'recently-played']);
    expect(layout.order).toHaveLength(DEFAULT_HOME_ORDER.length);
    expect(new Set(layout.order).size).toBe(DEFAULT_HOME_ORDER.length);
    expect(layout.hidden).toEqual(['mood-playlists']);
  });

  it('writes each change at once in the stored shape', () => {
    const storage = memoryStorage();
    const store = new HomeLayoutStore(storage);
    store.setShown('mood-playlists', false);
    expect(JSON.parse(storage.getItem(HOME_STORAGE_KEY) ?? '{}')).toMatchObject({
      v: 1,
      hidden: [...OFF_BY_DEFAULT, 'mood-playlists']
    });
    store.reorder(['random-songs', 'recently-played']);
    const stored = JSON.parse(storage.getItem(HOME_STORAGE_KEY) ?? '{}') as {
      order: string[];
      hidden: string[];
    };
    expect(stored.order.slice(0, 2)).toEqual(['random-songs', 'recently-played']);
    expect(stored.order).toHaveLength(DEFAULT_HOME_ORDER.length);
    expect(stored.hidden).toEqual([...OFF_BY_DEFAULT, 'mood-playlists']);
  });
});
