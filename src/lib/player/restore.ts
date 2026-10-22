/**
 * The playback a reload brings back.
 *
 * The queue, the track that was current and how far into it playback was are
 * kept per account in the browser's local storage, so reopening the client
 * shows what was playing on that account. The state is only ever restored
 * paused: bringing it back loads no audio and makes no call to the server, and
 * the queue is declared again only when the user presses play.
 *
 * The key carries the account's id, so two people who sign in on one browser
 * never see each other's queue. Reading is total: an entry that is missing,
 * unreadable or out of shape is dropped, and the player starts empty. Writing
 * is best effort: a storage that refuses the write keeps the queue for the
 * session.
 *
 * The stored shape is one JSON object, with `version` `1`, `items` (the queue
 * in play order), `currentIndex` (the index of the current track, `-1` for an
 * empty queue), `positionSecs` (how far into that track playback was) and
 * `original` (the order shuffle replaced, or `null`). Only the tracks around
 * the current one are kept - at most {@link PLAYBACK_QUEUE_LIMIT} of them - so
 * a queue built from a whole library cannot fill the storage. The shuffle and
 * repeat choices themselves are the player choices `settings.ts` keeps; this
 * entry carries the order a shuffled queue held.
 */
import type { QueueItem } from './queue.svelte';

/** The prefix every account's stored playback key starts with. */
export const PLAYBACK_STORAGE_PREFIX = 'hearthsound.playback.';

/**
 * How many queue items a stored playback keeps: the current item and its
 * neighbours, about half of them before it and half after it. A queue with more
 * items is trimmed around the current one before it is written.
 */
export const PLAYBACK_QUEUE_LIMIT = 1000;

/** How far playback must move before the stored position is rewritten. */
export const PLAYBACK_POSITION_WRITE_SECS = 5;

/** The version of the stored shape this module reads and writes. */
const PLAYBACK_FORMAT_VERSION = 1;

/** The part of a storage the player reads, writes and clears its state with. */
export type PlaybackStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** The playback a reload can bring back. */
export interface StoredPlayback {
  /** The queue in play order, at most {@link PLAYBACK_QUEUE_LIMIT} items. */
  items: QueueItem[];
  /** The index of the track that was current, or `-1` for an empty queue. */
  currentIndex: number;
  /** How far into the current track playback was, in seconds. */
  positionSecs: number;
  /** The order shuffle replaced while it was on, or `null`. */
  original: QueueItem[] | null;
}

/**
 * Returns the browser's local storage for the playback state.
 *
 * @returns The local storage, or `null` when it is absent or blocked.
 */
export function playbackStorage(): PlaybackStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Returns the key an account's playback is kept under.
 *
 * @param userId The account's client id.
 * @returns The storage key.
 */
export function playbackKey(userId: string): string {
  return `${PLAYBACK_STORAGE_PREFIX}${userId}`;
}

/**
 * Reads a stored text field.
 *
 * @param value The stored value.
 * @returns The text, `null` for an explicit null, or `undefined` when the
 *   value is absent or not text.
 */
function textOf(value: unknown): string | null | undefined {
  if (typeof value === 'string') {
    return value;
  }
  return value === null ? null : undefined;
}

/**
 * Reads one stored queue item.
 *
 * @param value The stored value.
 * @returns The item, or `null` when it is not a track.
 */
function parseItem(value: unknown): QueueItem | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (typeof record.id !== 'string' || typeof record.title !== 'string') {
    return null;
  }
  const item: QueueItem = { id: record.id, title: record.title };
  const artist = textOf(record.artist);
  if (artist !== undefined) {
    item.artist = artist;
  }
  const album = textOf(record.album);
  if (album !== undefined) {
    item.album = album;
  }
  const albumId = textOf(record.albumId);
  if (albumId !== undefined) {
    item.albumId = albumId;
  }
  const artistId = textOf(record.artistId);
  if (artistId !== undefined) {
    item.artistId = artistId;
  }
  const coverArt = textOf(record.coverArt);
  if (coverArt !== undefined) {
    item.coverArt = coverArt;
  }
  const contentType = textOf(record.contentType);
  if (contentType !== undefined) {
    item.contentType = contentType;
  }
  if (
    typeof record.durationSecs === 'number' &&
    Number.isFinite(record.durationSecs) &&
    record.durationSecs >= 0
  ) {
    item.durationSecs = record.durationSecs;
  } else if (record.durationSecs === null) {
    item.durationSecs = null;
  }
  if (typeof record.liked === 'boolean') {
    item.liked = record.liked;
  }
  if (typeof record.disliked === 'boolean') {
    item.disliked = record.disliked;
  }
  if (typeof record.rating === 'number' && Number.isFinite(record.rating)) {
    item.rating = record.rating;
  }
  return item;
}

/**
 * Reads a stored list of queue items.
 *
 * @param value The stored value.
 * @returns The items, or `null` when any of them is not a track.
 */
function parseItems(value: unknown): QueueItem[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items: QueueItem[] = [];
  for (const entry of value) {
    const item = parseItem(entry);
    if (item === null) {
      return null;
    }
    items.push(item);
  }
  return items;
}

/**
 * Reports whether two lists hold the same tracks, in any order.
 *
 * @param a The first list.
 * @param b The second list.
 * @returns Whether every id occurs as often in one list as in the other.
 */
function sameTracks(a: readonly QueueItem[], b: readonly QueueItem[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const counts = new Map<string, number>();
  for (const item of a) {
    counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  }
  for (const item of b) {
    const remaining = counts.get(item.id) ?? 0;
    if (remaining === 0) {
      return false;
    }
    counts.set(item.id, remaining - 1);
  }
  return true;
}

/**
 * Reads one stored playback entry.
 *
 * The entry is usable only when its version is known, every item is a track,
 * the current index names one of them (or `-1` for an empty queue) and the
 * remembered shuffle order holds the same tracks as the queue. A missing or
 * unreadable position falls back to the start.
 *
 * @param raw The stored JSON text, or `null` when nothing is stored.
 * @returns The playback to restore, or `null` when the entry is not usable.
 */
export function parseStoredPlayback(raw: string | null): StoredPlayback | null {
  if (raw === null) {
    return null;
  }
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;
  if (record.version !== PLAYBACK_FORMAT_VERSION) {
    return null;
  }
  const items = parseItems(record.items);
  if (items === null) {
    return null;
  }
  const index = record.currentIndex;
  if (items.length === 0) {
    if (index !== -1 && index !== 0 && index !== undefined) {
      return null;
    }
  } else if (
    typeof index !== 'number' ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= items.length
  ) {
    return null;
  }
  const positionSecs =
    typeof record.positionSecs === 'number' &&
    Number.isFinite(record.positionSecs) &&
    record.positionSecs >= 0
      ? record.positionSecs
      : 0;
  let original: QueueItem[] | null = null;
  if (record.original !== null && record.original !== undefined) {
    const parsed = parseItems(record.original);
    if (parsed === null || !sameTracks(parsed, items)) {
      return null;
    }
    original = parsed;
  }
  return {
    items,
    currentIndex: items.length === 0 ? -1 : (index as number),
    positionSecs,
    original
  };
}

/**
 * Trims a playback to {@link PLAYBACK_QUEUE_LIMIT} items around the current
 * one, moving the current index with it.
 *
 * The remembered shuffle order is cut down to the tracks that are kept.
 *
 * @param playback The playback to trim.
 * @returns The playback itself when it is short enough, or a trimmed copy.
 */
export function limitStoredPlayback(playback: StoredPlayback): StoredPlayback {
  if (playback.items.length <= PLAYBACK_QUEUE_LIMIT) {
    return playback;
  }
  const before = Math.floor(PLAYBACK_QUEUE_LIMIT / 2);
  const start = Math.min(
    Math.max(playback.currentIndex - before, 0),
    playback.items.length - PLAYBACK_QUEUE_LIMIT
  );
  const items = playback.items.slice(start, start + PLAYBACK_QUEUE_LIMIT);
  const counts = new Map<string, number>();
  for (const item of items) {
    counts.set(item.id, (counts.get(item.id) ?? 0) + 1);
  }
  const original: QueueItem[] | null =
    playback.original === null ? null : keepCounted(playback.original, counts);
  return {
    items,
    currentIndex: playback.currentIndex - start,
    positionSecs: playback.positionSecs,
    original
  };
}

/**
 * Keeps as many entries of a list as its counts allow, in order.
 *
 * @param items The list to cut down.
 * @param counts How often each id may still occur.
 * @returns The kept entries.
 */
function keepCounted(items: readonly QueueItem[], counts: Map<string, number>): QueueItem[] {
  const kept: QueueItem[] = [];
  for (const item of items) {
    const remaining = counts.get(item.id) ?? 0;
    if (remaining === 0) {
      continue;
    }
    counts.set(item.id, remaining - 1);
    kept.push(item);
  }
  return kept;
}

/**
 * Reads the playback stored for an account.
 *
 * An entry that cannot be read is removed, so the next reload does not ask
 * about it again.
 *
 * @param storage The storage to read, when there is one.
 * @param userId The account's client id.
 * @returns The stored playback, or `null` when there is none or it is not
 *   usable.
 */
export function readStoredPlayback(
  storage: PlaybackStorage | null,
  userId: string
): StoredPlayback | null {
  const key = playbackKey(userId);
  let raw: string | null;
  try {
    raw = storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
  if (raw === null) {
    return null;
  }
  const playback = parseStoredPlayback(raw);
  if (playback === null) {
    try {
      storage?.removeItem(key);
    } catch {
      // A storage that refuses the removal leaves the entry unread, which the
      // next read drops again.
    }
  }
  return playback;
}

/**
 * Stores the playback for an account, trimmed around the current track.
 *
 * @param storage The storage to write, when there is one.
 * @param userId The account's client id.
 * @param playback The playback to keep.
 * @returns Nothing.
 */
export function writeStoredPlayback(
  storage: PlaybackStorage | null,
  userId: string,
  playback: StoredPlayback
): void {
  try {
    storage?.setItem(
      playbackKey(userId),
      JSON.stringify({ version: PLAYBACK_FORMAT_VERSION, ...limitStoredPlayback(playback) })
    );
  } catch {
    // A storage that refuses the write keeps the playback for this session.
  }
}

/**
 * Removes the playback stored for an account.
 *
 * @param storage The storage to clear, when there is one.
 * @param userId The account's client id.
 * @returns Nothing.
 */
export function clearStoredPlayback(storage: PlaybackStorage | null, userId: string): void {
  try {
    storage?.removeItem(playbackKey(userId));
  } catch {
    // A storage that refuses the removal leaves nothing this session can do.
  }
}
