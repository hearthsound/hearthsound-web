/**
 * Tests for the playback a reload brings back: what is written, what restoring
 * shows and what it deliberately does not do.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { availabilityEvent, FakeEventStream } from '#lib/testing/event-stream';
import { FakeAudio, FakeStorage, FakeVendor } from '#lib/testing/player';
import { AvailabilityStore } from '#lib/stores/availability.svelte';
import { ToastStore } from '#lib/stores/toasts.svelte';
import type { PlayQueue } from '#lib/subsonic/types';
import { QUEUE_DECLARE_DELAY_MS, PREFETCH_DELAY_MS } from './declaration';
import { Player } from './player.svelte';
import type { QueueItem } from './queue.svelte';
import {
  parseStoredPlayback,
  playbackKey,
  PLAYBACK_QUEUE_LIMIT,
  readStoredPlayback,
  writeStoredPlayback
} from './restore';
import type { StoredPlayback } from './restore';

/** The client instance name the tests run under. */
const CLIENT = 'hearthsound-web-00000000';

/** The account the tests keep playback for. */
const USER = 'us_1';

/**
 * Builds a queue item.
 *
 * @param id The track's id.
 * @param overrides The fields to change.
 * @returns The item.
 */
function item(id: string, overrides: Partial<QueueItem> = {}): QueueItem {
  return { id, title: id, ...overrides };
}

/** A player over scripted doubles. */
interface Rig {
  player: Player;
  audio: FakeAudio;
  vendor: FakeVendor;
  streams: FakeEventStream;
  states: AvailabilityStore;
}

/**
 * Builds a player over fake doubles.
 *
 * @param storage The storage to keep the playback in.
 * @returns The player and the doubles it drives.
 */
function rig(storage: FakeStorage): Rig {
  const audio = new FakeAudio();
  const vendor = new FakeVendor();
  const streams = new FakeEventStream();
  const states = new AvailabilityStore();
  const player = new Player({
    audio,
    api: vendor,
    events: streams,
    client: CLIENT,
    toasts: new ToastStore(),
    availability: states,
    storage
  });
  return { player, audio, vendor, streams, states };
}

/**
 * Returns the playback stored for the test account.
 *
 * @param storage The storage to read.
 * @returns The stored playback, or `null`.
 */
function stored(storage: FakeStorage): StoredPlayback | null {
  return readStoredPlayback(storage, USER);
}

describe('stored playback', () => {
  it('keeps the queue, the current track and the position', () => {
    const playback: StoredPlayback = {
      items: [
        item('tr_1', { title: 'One', artist: 'Band', durationSecs: 100 }),
        item('tr_2', { title: 'Two', durationSecs: 200 })
      ],
      currentIndex: 1,
      positionSecs: 37.5,
      original: null
    };
    const storage = new FakeStorage();

    writeStoredPlayback(storage, USER, playback);

    expect(stored(storage)).toEqual(playback);
  });

  it('drops an entry that cannot be read and keeps it gone', () => {
    const storage = new FakeStorage();
    storage.setItem(playbackKey(USER), '{"version":1,"items":[');

    expect(stored(storage)).toBeNull();
    expect(storage.getItem(playbackKey(USER))).toBeNull();
  });

  it('rejects an entry whose current index names no track', () => {
    const storage = new FakeStorage();
    storage.setItem(
      playbackKey(USER),
      JSON.stringify({ version: 1, items: [item('tr_1')], currentIndex: 4, positionSecs: 0 })
    );

    expect(stored(storage)).toBeNull();
    expect(storage.getItem(playbackKey(USER))).toBeNull();
  });

  it('falls back to the start when the stored position is unusable', () => {
    const raw = JSON.stringify({
      version: 1,
      items: [item('tr_1')],
      currentIndex: 0,
      positionSecs: -4
    });

    expect(parseStoredPlayback(raw)?.positionSecs).toBe(0);
  });

  it('keeps at most the items around the current one', () => {
    const items = Array.from({ length: 6000 }, (_, index) => item(`tr_${index}`));
    const storage = new FakeStorage();

    writeStoredPlayback(storage, USER, {
      items,
      currentIndex: 3000,
      positionSecs: 12,
      original: [...items].reverse()
    });

    const playback = stored(storage);
    expect(playback).not.toBeNull();
    expect(playback?.items).toHaveLength(PLAYBACK_QUEUE_LIMIT);
    expect(playback?.items[0].id).toBe('tr_2500');
    expect(playback?.items.at(-1)?.id).toBe('tr_3499');
    expect(playback?.items[playback.currentIndex].id).toBe('tr_3000');
    expect(playback?.original).toHaveLength(PLAYBACK_QUEUE_LIMIT);
  });

  it('keeps each account apart', () => {
    const storage = new FakeStorage();
    writeStoredPlayback(storage, 'us_1', {
      items: [item('tr_1')],
      currentIndex: 0,
      positionSecs: 10,
      original: null
    });
    const { player } = rig(storage);

    player.restorePlayback('us_2');
    expect(player.queue.current).toBeNull();
    expect(stored(storage)?.items.map((entry) => entry.id)).toEqual(['tr_1']);

    player.restorePlayback('us_1');
    expect(player.queue.current?.id).toBe('tr_1');
  });

  it('clears every account playback on the browser', () => {
    const storage = new FakeStorage();
    writeStoredPlayback(storage, 'us_1', {
      items: [item('tr_1')],
      currentIndex: 0,
      positionSecs: 10,
      original: null
    });
    writeStoredPlayback(storage, 'us_2', {
      items: [item('tr_2')],
      currentIndex: 0,
      positionSecs: 4,
      original: null
    });
    const { player } = rig(storage);

    player.forgetAllPlayback();

    expect(readStoredPlayback(storage, 'us_1')).toBeNull();
    expect(readStoredPlayback(storage, 'us_2')).toBeNull();
  });
});

describe('player restore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('shows the stored queue and position without starting anything', async () => {
    const storage = new FakeStorage();
    const playback: StoredPlayback = {
      items: [
        item('tr_1', { title: 'One', durationSecs: 100 }),
        item('tr_2', { title: 'Two', durationSecs: 200 })
      ],
      currentIndex: 0,
      positionSecs: 37,
      original: null
    };
    writeStoredPlayback(storage, USER, playback);
    const { player, audio, vendor } = rig(storage);

    player.restorePlayback(USER);

    expect(player.queue.items.map((entry) => entry.id)).toEqual(['tr_1', 'tr_2']);
    expect(player.queue.current?.id).toBe('tr_1');
    expect(player.positionSecs).toBe(37);
    expect(player.durationSecs).toBe(100);
    expect(player.playing).toBe(false);
    expect(audio.playCount).toBe(0);

    await vi.advanceTimersByTimeAsync(QUEUE_DECLARE_DELAY_MS + PREFETCH_DELAY_MS);

    expect(audio.playCount).toBe(0);
    expect(vendor.acquireRequests).toEqual([]);
    expect(vendor.scrobbles).toEqual([]);
    expect(vendor.declarations).toEqual([]);
    expect(vendor.availabilityReads).toEqual([]);
  });

  it('resumes the stored track from the stored position on the first play', () => {
    const storage = new FakeStorage();
    writeStoredPlayback(storage, USER, {
      items: [item('tr_1', { title: 'One', durationSecs: 100 })],
      currentIndex: 0,
      positionSecs: 37,
      original: null
    });
    const { player, audio, vendor } = rig(storage);
    player.restorePlayback(USER);

    player.toggle();

    expect(audio.playCount).toBe(1);
    expect(new URL(audio.src, 'http://localhost').searchParams.get('id')).toBe('tr_1');
    expect(audio.currentTime).toBe(37);
    expect(player.playing).toBe(true);
    expect(vendor.scrobbles).toEqual([{ id: 'tr_1', submission: false }]);
  });

  it('acquires a remote track first and then plays it from the start', async () => {
    const storage = new FakeStorage();
    writeStoredPlayback(storage, USER, {
      items: [item('x_deezer_1', { title: 'Catalog Song', durationSecs: 200 })],
      currentIndex: 0,
      positionSecs: 40,
      original: null
    });
    const { player, audio, vendor, streams, states } = rig(storage);
    states.set('x_deezer_1', 'remote');
    vendor.acquisitions = [
      { id: 'ac_1', targetId: 'tr_9', state: 'downloading', priority: 'play', percent: 10 }
    ];
    player.restorePlayback(USER);

    player.toggle();
    await vi.advanceTimersByTimeAsync(0);

    expect(audio.playCount).toBe(0);
    expect(vendor.acquireRequests).toEqual([{ ids: ['x_deezer_1'], priority: 'play' }]);
    expect(vendor.scrobbles).toEqual([]);

    streams.emit(availabilityEvent('tr_9', 'local'));

    expect(audio.playCount).toBe(1);
    expect(new URL(audio.src, 'http://localhost').searchParams.get('id')).toBe('tr_9');
    expect(audio.currentTime).toBe(0);
  });

  it('starts empty when the stored entry is corrupt and asks for no track', async () => {
    const storage = new FakeStorage();
    storage.setItem(playbackKey(USER), 'not json');
    const { player, vendor } = rig(storage);

    player.restorePlayback(USER);

    expect(player.queue.current).toBeNull();
    expect(storage.getItem(playbackKey(USER))).toBeNull();

    await vi.advanceTimersByTimeAsync(QUEUE_DECLARE_DELAY_MS + PREFETCH_DELAY_MS);

    expect(vendor.acquireRequests).toEqual([]);
    expect(vendor.declarations).toEqual([]);
  });

  it('writes the position every five seconds and when playback pauses', () => {
    const storage = new FakeStorage();
    const { player, audio } = rig(storage);
    player.restorePlayback(USER);
    player.play([item('tr_1', { durationSecs: 200 })], 0);

    audio.currentTime = 4;
    audio.emit('timeupdate');
    expect(stored(storage)?.positionSecs).toBe(0);

    audio.currentTime = 5;
    audio.emit('timeupdate');
    expect(stored(storage)?.positionSecs).toBe(5);

    audio.currentTime = 7;
    audio.emit('timeupdate');
    expect(stored(storage)?.positionSecs).toBe(5);

    player.toggle();
    expect(stored(storage)?.positionSecs).toBe(7);
  });

  it('writes the position when the page goes away', () => {
    const listeners = new Map<string, () => void>();
    vi.stubGlobal('window', {
      addEventListener: (type: string, listener: () => void) => listeners.set(type, listener)
    });
    const storage = new FakeStorage();
    const { player, audio } = rig(storage);
    player.restorePlayback(USER);
    player.play([item('tr_1', { durationSecs: 200 })], 0);
    audio.currentTime = 3;
    audio.emit('timeupdate');

    expect(stored(storage)?.positionSecs).toBe(0);
    listeners.get('pagehide')?.();

    expect(stored(storage)?.positionSecs).toBe(3);
  });

  it('brings back the remembered order of a shuffled queue', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const storage = new FakeStorage();
    const first = rig(storage);
    first.player.restorePlayback(USER);
    first.player.play([item('a'), item('b'), item('c'), item('d')], 0);

    first.player.toggleShuffle();
    const shuffled = first.player.queue.items.map((entry) => entry.id);
    expect(shuffled).toEqual(['a', 'c', 'd', 'b']);

    const next = rig(storage);
    next.player.restorePlayback(USER);

    expect(next.player.shuffle).toBe(true);
    expect(next.player.queue.items.map((entry) => entry.id)).toEqual(shuffled);

    next.player.toggleShuffle();
    expect(next.player.queue.items.map((entry) => entry.id)).toEqual(['a', 'b', 'c', 'd']);

    random.mockRestore();
  });

  it('restores a shuffled queue with the queue own item objects', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const storage = new FakeStorage();
    const first = rig(storage);
    first.player.restorePlayback(USER);
    first.player.play([item('a'), item('b'), item('c'), item('d')], 1);
    first.player.toggleShuffle();

    const next = rig(storage);
    next.player.restorePlayback(USER);

    expect(next.player.queue.shuffle).toBe(true);
    expect(
      next.player.queue.originalItems?.every((entry) => next.player.queue.items.includes(entry))
    ).toBe(true);

    next.player.toggleShuffle();

    expect(next.player.shuffle).toBe(false);
    expect(next.player.queue.current?.id).toBe('b');
    expect(next.player.queue.currentIndex).toBe(1);
    random.mockRestore();
  });

  it('clears the previous account queue when the next has nothing stored', () => {
    const storage = new FakeStorage();
    const { player, audio } = rig(storage);
    player.restorePlayback('us_1');
    player.play([item('tr_1', { durationSecs: 100 })], 0);
    player.forgetAllPlayback();

    player.restorePlayback('us_2');

    expect(player.queue.current).toBeNull();
    expect(player.playing).toBe(false);
    expect(player.positionSecs).toBe(0);
    expect(audio.paused).toBe(true);
  });

  it('moves the stored position when the bar is sought before playing', () => {
    const storage = new FakeStorage();
    writeStoredPlayback(storage, USER, {
      items: [item('tr_1', { durationSecs: 100 })],
      currentIndex: 0,
      positionSecs: 20,
      original: null
    });
    const { player, audio } = rig(storage);
    player.restorePlayback(USER);

    player.seek(50);
    expect(audio.playCount).toBe(0);
    expect(player.positionSecs).toBe(50);
    expect(stored(storage)?.positionSecs).toBe(50);

    player.toggle();
    expect(audio.currentTime).toBe(50);
  });

  it('brings back the queue the server saved when the browser has none', async () => {
    const storage = new FakeStorage();
    const { player, audio, vendor } = rig(storage);
    vendor.savedQueue = {
      current: 'tr_2',
      position: 3000,
      entry: [
        { id: 'tr_1', title: 'One', artist: 'Band', album: 'Album', duration: 120 },
        { id: 'tr_2', name: 'Two', duration: 240 }
      ]
    };

    player.restorePlayback(USER);
    await vi.advanceTimersByTimeAsync(0);

    expect(player.queue.items.map((entry) => entry.id)).toEqual(['tr_1', 'tr_2']);
    expect(player.queue.current?.id).toBe('tr_2');
    expect(player.positionSecs).toBe(3);
    expect(player.durationSecs).toBe(240);
    expect(player.playing).toBe(false);
    expect(audio.playCount).toBe(0);
    expect(vendor.acquireRequests).toEqual([]);
    expect(vendor.scrobbles).toEqual([]);

    await vi.advanceTimersByTimeAsync(QUEUE_DECLARE_DELAY_MS + PREFETCH_DELAY_MS);

    expect(vendor.declarations).toEqual([]);
    expect(vendor.availabilityReads).toEqual([]);
    expect(stored(storage)?.items.map((entry) => entry.id)).toEqual(['tr_1', 'tr_2']);
    expect(stored(storage)?.positionSecs).toBe(3);
  });

  it('drops a saved queue that answers after the account changed', async () => {
    const storage = new FakeStorage();
    writeStoredPlayback(storage, 'us_2', {
      items: [item('tr_9', { durationSecs: 100 })],
      currentIndex: 0,
      positionSecs: 5,
      original: null
    });
    const answer = Promise.withResolvers<PlayQueue | null>();
    const { player, vendor } = rig(storage);
    vendor.readSavedQueue = () => answer.promise;

    player.restorePlayback('us_1');
    player.restorePlayback('us_2');
    answer.resolve({ current: 'tr_1', position: 5000, entry: [{ id: 'tr_1', title: 'One' }] });
    await vi.advanceTimersByTimeAsync(0);

    expect(player.queue.items.map((entry) => entry.id)).toEqual(['tr_9']);
    expect(player.positionSecs).toBe(5);
  });
});
