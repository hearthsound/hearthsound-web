/**
 * Tests for the lyrics timing helpers: which line is current at a position and
 * how unsynced lines group into verses.
 */
import { describe, expect, it } from 'vitest';

import { currentLineIndex, versesOf } from './lyrics.svelte';
import type { Lyrics, LyricsLine } from './lyrics.svelte';

/**
 * Builds one lyric line.
 *
 * @param text The line's text.
 * @param atMs When it starts, in milliseconds.
 * @param verseBreak Whether it starts a verse.
 * @returns The line.
 */
function line(text: string, atMs: number | null, verseBreak = false): LyricsLine {
  return { text, atMs, verseBreak };
}

/** A synced song: the first line waits two seconds, the last starts at 30. */
const SYNCED: Lyrics = {
  synced: true,
  source: 'Fixture',
  lines: [line('one', 2000), line('two', 5000), line('three', 30_000)]
};

describe('current line', () => {
  it('holds the first line before the first time', () => {
    expect(currentLineIndex(SYNCED, 0)).toBe(0);
    expect(currentLineIndex(SYNCED, 1999)).toBe(0);
  });

  it('moves the line at its exact timestamp', () => {
    expect(currentLineIndex(SYNCED, 2000)).toBe(0);
    expect(currentLineIndex(SYNCED, 5000)).toBe(1);
    expect(currentLineIndex(SYNCED, 29_999)).toBe(1);
    expect(currentLineIndex(SYNCED, 30_000)).toBe(2);
  });

  it('holds the last line after the last time', () => {
    expect(currentLineIndex(SYNCED, 3_600_000)).toBe(2);
  });

  it('treats an untimed line as the first one', () => {
    const unsynced: Lyrics = {
      synced: false,
      source: 'Fixture',
      lines: [line('one', null, true), line('two', null)]
    };
    expect(currentLineIndex(unsynced, 12_345)).toBe(0);
  });
});

describe('verses', () => {
  it('splits unsynced lines at their verse breaks', () => {
    const unsynced: Lyrics = {
      synced: false,
      source: 'Fixture',
      lines: [
        line('one', null, true),
        line('two', null),
        line('three', null, true),
        line('four', null)
      ]
    };
    expect(versesOf(unsynced)).toEqual([
      ['one', 'two'],
      ['three', 'four']
    ]);
  });

  it('opens the first verse even without a break', () => {
    const unsynced: Lyrics = {
      synced: false,
      source: 'Fixture',
      lines: [line('one', null), line('two', null, true), line('three', null)]
    };
    expect(versesOf(unsynced)).toEqual([['one'], ['two', 'three']]);
  });

  it('has no verses without lines', () => {
    expect(versesOf({ synced: false, source: 'Fixture', lines: [] })).toEqual([]);
  });
});
