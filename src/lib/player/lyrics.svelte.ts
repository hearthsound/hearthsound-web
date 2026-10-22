/**
 * The lyrics the now-playing panel draws.
 *
 * A song's lyrics are a source's name and either lines with a time or lines
 * without one. No server source provides them yet (milestone A5): the panel
 * renders whatever {@link Lyrics} value it is given, and the queue is what
 * shows until one arrives. The timing helpers here are what the synced panel
 * follows and the unsynced panel splits by verse.
 */

/** One line of lyrics. */
export interface LyricsLine {
  /** The line's text. */
  text: string;
  /** When the line starts, in milliseconds, or `null` when not synced. */
  atMs: number | null;
  /**
   * Whether the line starts a verse. The unsynced panel spaces verses apart
   * and runs their lines together (p20b).
   */
  verseBreak: boolean;
}

/** The lyrics of one song. */
export interface Lyrics {
  /** Whether the lines carry times. */
  synced: boolean;
  /** The lines in reading order. */
  lines: LyricsLine[];
  /** The instance that served them, named under the lines. */
  source: string;
}

/**
 * Finds the line that plays at a position.
 *
 * The line stays current until the next line's time, so a position between two
 * times belongs to the earlier line.
 *
 * @param lyrics The song's lyrics.
 * @param positionMs The playback position in milliseconds.
 * @returns The index of the current line; the first line before the first
 *   time, and the last line after the last.
 */
export function currentLineIndex(lyrics: Lyrics, positionMs: number): number {
  let current = 0;
  for (const [index, line] of lyrics.lines.entries()) {
    if (line.atMs !== null && line.atMs <= positionMs) {
      current = index;
    }
  }
  return current;
}

/**
 * Splits unsynced lines into their verses.
 *
 * A line that starts a verse opens a new one; the lyrics' first line opens the
 * first verse whether or not it is marked, so a source that marks only the
 * later breaks still renders every line.
 *
 * @param lyrics The song's lyrics.
 * @returns One array of lines per verse.
 */
export function versesOf(lyrics: Lyrics): string[][] {
  const verses: string[][] = [];
  for (const line of lyrics.lines) {
    if (line.verseBreak || verses.length === 0) {
      verses.push([]);
    }
    verses[verses.length - 1].push(line.text);
  }
  return verses;
}
