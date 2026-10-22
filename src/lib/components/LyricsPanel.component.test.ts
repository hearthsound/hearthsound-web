/**
 * Tests for the lyrics panel: which line is marked current at a position, how
 * unsynced lyrics group into verses, and the source line under them.
 */
import { render } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Lyrics, LyricsLine } from '#lib/player/lyrics.svelte';

import LyricsPanel from './LyricsPanel.svelte';

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

/** A synced song: its first line waits two seconds, the last starts at 30. */
const SYNCED: Lyrics = {
  synced: true,
  source: 'Fixture',
  lines: [line('first line', 2000), line('second line', 5000), line('last line', 30_000)]
};

/** An unsynced song in two verses. */
const UNSYNCED: Lyrics = {
  synced: false,
  source: 'Fixture',
  lines: [
    line('verse one, line one', null, true),
    line('verse one, line two', null),
    line('verse two, line one', null, true),
    line('verse two, line two', null)
  ]
};

let resize: (() => void) | null = null;

beforeEach(() => {
  resize = null;
  // jsdom has no media queries and no layout observation. The panel uses both
  // only to place the current line; the assertions below read the DOM.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({ matches: false, media: query })
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      /** Accepts an element without observing layout. */
      observe(): void {}
      /** Stops observing. */
      disconnect(): void {}
    }
  );
});

/**
 * Returns the text of the line marked current, if there is one.
 *
 * @returns The line's text, or `null` when no line is current.
 */
function currentLine(): string | null {
  return (
    document.querySelector('.hs-lyrics-line[aria-current="true"]')?.textContent?.trim() ?? null
  );
}

describe('synced lyrics', () => {
  it('marks the first line before the first time', () => {
    render(LyricsPanel, { lyrics: SYNCED, positionMs: 0 });

    expect(currentLine()).toBe('first line');
  });

  it('keeps a line current until the next one starts', () => {
    const { rerender } = render(LyricsPanel, { lyrics: SYNCED, positionMs: 2000 });

    expect(currentLine()).toBe('first line');

    rerender({ lyrics: SYNCED, positionMs: 4999 });
    expect(currentLine()).toBe('first line');

    rerender({ lyrics: SYNCED, positionMs: 5000 });
    expect(currentLine()).toBe('second line');
  });

  it('holds the last line after the last time', () => {
    render(LyricsPanel, { lyrics: SYNCED, positionMs: 200_000 });

    expect(currentLine()).toBe('last line');
  });

  it('names the source under the lines', () => {
    render(LyricsPanel, { lyrics: SYNCED, positionMs: 0 });

    expect(document.querySelector('.hs-lyrics-note--source')?.textContent?.trim()).toBe(
      'Lyrics from Fixture'
    );
  });

  it('scrolls the playing line to the middle of the panel', () => {
    render(LyricsPanel, { lyrics: SYNCED, positionMs: 5000 });

    const panel = document.querySelector<HTMLDivElement>('.hs-now-playing__panel');
    const line = document.querySelector<HTMLElement>('.hs-lyrics-line[aria-current="true"]');
    if (panel === null || line === null) {
      throw new Error('the panel did not render its current line');
    }
    // jsdom lays nothing out, so the sizes the panel measures are given here.
    Object.defineProperty(panel, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(line, 'clientHeight', { configurable: true, value: 40 });
    Object.defineProperty(line, 'offsetTop', { configurable: true, value: 300 });
    resize?.();

    expect(panel.scrollTop).toBe(120);
  });
});

describe('unsynced lyrics', () => {
  it('renders one paragraph per verse and marks no line current', () => {
    render(LyricsPanel, { lyrics: UNSYNCED, positionMs: 6000 });

    const verses = Array.from(document.querySelectorAll('.hs-lyrics-line')).map((element) =>
      element.textContent?.trim()
    );
    expect(verses).toEqual([
      'verse one, line one\nverse one, line two',
      'verse two, line one\nverse two, line two'
    ]);
    expect(document.querySelector('.hs-lyrics-line[aria-current="true"]')).toBeNull();
  });

  it('says the lyrics are not synced and names the source', () => {
    render(LyricsPanel, { lyrics: UNSYNCED, positionMs: 0 });

    expect(document.body.textContent).toContain('Not synced to the music');
    expect(document.body.textContent).toContain('Lyrics from Fixture');
  });
});
