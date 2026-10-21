/**
 * The lyrics the now-playing panel draws.
 *
 * TEMPORARY. There is no lyrics source yet: no endpoint returns lyrics and no
 * plugin provides them (A5 is unstarted). This module carries the model the
 * panel consumes - lines with a time or without one, the source's name - and a
 * demo source behind `?lyrics=synced` or `?lyrics=unsynced` so the approved
 * arrangements (p20-r4 synced, p20b unsynced) can be reviewed in the running
 * client. Wiring the real source replaces {@link demoLyrics} and the view does
 * not change.
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

/** The synced demo song, timed across three and a quarter minutes. */
const SYNCED: readonly string[] = [
  'Lanterns down along the water',
  'Every window holds a light',
  'I have counted all the harbours',
  'Waiting for the turn of night',
  'Hold the field and hold the quiet',
  'Hold the hour before the rain',
  'If the lantern keeps on burning',
  'I will find the road again',
  'Lanterns down along the water',
  'Every window holds a light',
  'Lanterns down along the water'
];

/** The unsynced demo song, in four verses. */
const UNSYNCED: readonly (readonly string[])[] = [
  [
    'The kettle hums against the morning',
    'and the window keeps the rain',
    'somewhere out beyond the harbour',
    'a bell is counting once again'
  ],
  [
    'I left a light along the stairwell',
    'I left the door a little wide',
    'so every road that comes back homeward',
    'can find its way to the inside'
  ],
  [
    'Hold the field and hold the quiet',
    'hold the hour before the rain',
    'if the lantern keeps on burning',
    'I will find the road again'
  ],
  ['The kettle hums against the morning', 'and the window keeps the rain']
];

/**
 * Reads the demo lyrics a query parameter asks for.
 *
 * TEMPORARY: `?lyrics=synced` and `?lyrics=unsynced` are review switches for
 * the two approved arrangements; any other value, and no value, returns
 * `null`, which is what the view shows until a source exists.
 *
 * @param param The `lyrics` query parameter of the current address.
 * @returns The demo lyrics, or `null` when the address does not ask for them.
 */
export function demoLyrics(param: string | null): Lyrics | null {
  if (param === 'synced') {
    return {
      synced: true,
      source: 'Demo',
      lines: SYNCED.map((text, index) => ({
        text,
        atMs: index * 17_000,
        verseBreak: index === 0
      }))
    };
  }
  if (param === 'unsynced') {
    return {
      synced: false,
      source: 'Demo',
      lines: UNSYNCED.flatMap((verse) =>
        verse.map((text, index) => ({ text, atMs: null, verseBreak: index === 0 }))
      )
    };
  }
  return null;
}

/**
 * Finds the line that plays at a position.
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
