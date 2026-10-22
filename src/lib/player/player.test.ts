/**
 * Tests for the player: the stream it loads, the play it reports, the queue it
 * declares and the failure it retries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  acquisitionEvent,
  availabilityEvent,
  FakeEventStream,
  prefetchEvent
} from '#lib/testing/event-stream';
import { FakeAudio, FakeStorage, FakeVendor } from '#lib/testing/player';
import { AvailabilityStore } from '#lib/stores/availability.svelte';
import { ToastStore } from '#lib/stores/toasts.svelte';
import type { QueueItem } from './queue.svelte';
import { clientName, CLIENT_NAME_KEY } from './client';
import { PREFETCH_DELAY_MS, QUEUE_DECLARE_DELAY_MS } from './declaration';
import { Player } from './player.svelte';
import type { PlaybackStorage } from './restore';
import { parsePlayerSettings, PLAYER_SETTINGS_KEY } from './settings';
import { scrobbleThresholdReached, SCROBBLE_FLOOR_SECS } from './scrobble';

/** The client instance name the tests run under. */
const CLIENT = 'hearthsound-web-00000000';

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
  toasts: ToastStore;
  states: AvailabilityStore;
}

/**
 * Builds a player over fake doubles.
 *
 * @returns The player and the doubles it drives.
 */
function rig(storage?: PlaybackStorage | null): Rig {
  const audio = new FakeAudio();
  const vendor = new FakeVendor();
  const streams = new FakeEventStream();
  const toasts = new ToastStore();
  const states = new AvailabilityStore();
  const player = new Player({
    audio,
    api: vendor,
    events: streams,
    client: CLIENT,
    toasts,
    availability: states,
    storage
  });
  return { player, audio, vendor, streams, toasts, states };
}

describe('scrobble threshold', () => {
  it('records a play at half the track', () => {
    expect(scrobbleThresholdReached(49, 100)).toBe(false);
    expect(scrobbleThresholdReached(50, 100)).toBe(true);
    expect(scrobbleThresholdReached(60, 100)).toBe(true);
  });

  it('records a long track at the floor instead', () => {
    expect(scrobbleThresholdReached(SCROBBLE_FLOOR_SECS - 1, 3600)).toBe(false);
    expect(scrobbleThresholdReached(SCROBBLE_FLOOR_SECS, 3600)).toBe(true);
  });

  it('holds a track of unknown length to the floor', () => {
    expect(scrobbleThresholdReached(SCROBBLE_FLOOR_SECS, Number.NaN)).toBe(true);
    expect(scrobbleThresholdReached(SCROBBLE_FLOOR_SECS, 0)).toBe(true);
  });
});

describe('client name', () => {
  it('is one name per tab', () => {
    const storage = new FakeStorage();

    const first = clientName(storage as unknown as Storage);
    const second = clientName(storage as unknown as Storage);

    expect(first).toMatch(/^hearthsound-web-[0-9a-f]{8}$/);
    expect(second).toBe(first);
    expect(storage.getItem(CLIENT_NAME_KEY)).toBe(first);
  });

  it('is generated even without a storage', () => {
    expect(clientName(null)).toMatch(/^hearthsound-web-[0-9a-f]{8}$/);
  });
});

describe('player settings', () => {
  it('reads the stored volume and mute, falling back when unreadable', () => {
    const defaults = { volume: 1, muted: false, shuffle: false, repeat: 'off' };
    expect(parsePlayerSettings(null)).toEqual(defaults);
    expect(parsePlayerSettings('not json')).toEqual(defaults);
    expect(parsePlayerSettings('{"shuffle":true,"repeat":"song"}')).toEqual({
      ...defaults,
      shuffle: true,
      repeat: 'song'
    });
    expect(parsePlayerSettings('{"repeat":"forever"}').repeat).toBe('off');
    expect(parsePlayerSettings('{"volume":2,"muted":"yes"}')).toEqual(defaults);
    expect(parsePlayerSettings('{"volume":0.35,"muted":true}')).toEqual({
      ...defaults,
      volume: 0.35,
      muted: true
    });
  });

  it('stores the volume and mute and applies them to the next element', () => {
    const storage = new FakeStorage();
    const first = rig(storage);
    first.player.setVolume(0.4);
    first.player.toggleMute();

    expect(JSON.parse(storage.getItem(PLAYER_SETTINGS_KEY) ?? 'null')).toMatchObject({
      volume: 0.4,
      muted: true
    });

    const next = rig(storage);
    expect(next.player.volume).toBe(0.4);
    expect(next.player.muted).toBe(true);
    expect(next.audio.volume).toBe(0.4);
    expect(next.audio.muted).toBe(true);
  });

  it('keeps the volume when the output is muted', () => {
    const { player, audio } = rig();
    player.setVolume(0.4);

    player.toggleMute();
    expect(player.muted).toBe(true);
    expect(player.volume).toBe(0.4);
    expect(audio.muted).toBe(true);
    expect(audio.volume).toBe(0.4);

    player.toggleMute();
    expect(player.muted).toBe(false);
    expect(player.volume).toBe(0.4);
    expect(audio.volume).toBe(0.4);
  });

  it('unmutes when the volume changes', () => {
    const { player, audio } = rig();
    player.toggleMute();
    expect(audio.muted).toBe(true);

    player.setVolume(0.6);

    expect(player.muted).toBe(false);
    expect(audio.muted).toBe(false);
    expect(audio.volume).toBe(0.6);
  });

  it('clamps the volume into the range the element takes', () => {
    const { player, audio } = rig();

    player.setVolume(2);
    expect(player.volume).toBe(1);
    expect(audio.volume).toBe(1);

    player.setVolume(-1);
    expect(player.volume).toBe(0);
    expect(audio.volume).toBe(0);
  });
});

describe('player', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the stream of the current track and reports it as playing', () => {
    const { player, audio, vendor } = rig();

    player.play([item('tr_1', { contentType: 'audio/flac' })], 0);

    const url = new URL(audio.src, 'http://localhost');
    expect(url.pathname).toBe('/rest/stream');
    expect(url.searchParams.get('id')).toBe('tr_1');
    expect(url.searchParams.get('format')).toBe('raw');
    expect(audio.playCount).toBe(1);
    expect(player.playing).toBe(true);
    expect(vendor.scrobbles).toEqual([{ id: 'tr_1', submission: false }]);
  });

  it('reports the play once, when the threshold is reached', () => {
    const { player, audio, vendor } = rig();
    player.play([item('tr_1')], 0);
    audio.duration = 100;

    audio.currentTime = 49;
    audio.emit('timeupdate');
    expect(vendor.scrobbles).toHaveLength(1);

    audio.currentTime = 50;
    audio.emit('timeupdate');
    audio.currentTime = 90;
    audio.emit('timeupdate');

    expect(vendor.scrobbles).toEqual([
      { id: 'tr_1', submission: false },
      { id: 'tr_1', submission: true }
    ]);
  });

  it('declares the queue and looks ahead at the next items', async () => {
    const { player, vendor } = rig();

    player.play([item('tr_1'), item('tr_2'), item('tr_3'), item('tr_4'), item('tr_5')], 0);
    expect(vendor.declarations).toEqual([]);

    await vi.advanceTimersByTimeAsync(QUEUE_DECLARE_DELAY_MS);

    expect(vendor.declarations).toEqual([
      { current: 'tr_1', next: ['tr_2', 'tr_3', 'tr_4', 'tr_5'], client: CLIENT }
    ]);
    expect(vendor.availabilityReads).toEqual([]);

    await vi.advanceTimersByTimeAsync(PREFETCH_DELAY_MS);

    expect(vendor.availabilityReads).toEqual([['tr_2', 'tr_3', 'tr_4']]);
  });

  it('declares a queue that changed again once, with its latest shape', async () => {
    const { player, vendor } = rig();

    player.play([item('tr_1'), item('tr_2')], 0);
    await vi.advanceTimersByTimeAsync(QUEUE_DECLARE_DELAY_MS / 2);
    player.append([item('tr_3')]);
    await vi.advanceTimersByTimeAsync(QUEUE_DECLARE_DELAY_MS);

    expect(vendor.declarations).toEqual([
      { current: 'tr_1', next: ['tr_2', 'tr_3'], client: CLIENT }
    ]);
  });

  it('declares nothing while the queue has no next track', async () => {
    const { player, vendor } = rig();

    player.play([item('tr_1')], 0);
    await vi.advanceTimersByTimeAsync(QUEUE_DECLARE_DELAY_MS + PREFETCH_DELAY_MS);

    expect(vendor.declarations).toEqual([]);
    expect(vendor.availabilityReads).toEqual([]);
  });

  it('fills the prefetch state of the upcoming items', async () => {
    const { player, vendor } = rig();
    vendor.availability = [
      { id: 'tr_2', state: 'acquiring', inLibrary: false, acquisitionId: 'ac_1' }
    ];

    player.play([item('tr_1'), item('tr_2')], 0);
    await vi.advanceTimersByTimeAsync(QUEUE_DECLARE_DELAY_MS + PREFETCH_DELAY_MS);

    expect(player.prefetch.stateFor('tr_2').acquisitionId).toBe('ac_1');
    expect(player.prefetch.stateFor('tr_2').availability).toBe('acquiring');
  });

  it('retries a stored file once as a transcode, then gives up', () => {
    const { player, audio, toasts } = rig();
    player.play([item('tr_1', { contentType: 'audio/flac', title: 'One' })], 0);

    audio.emit('error');

    const retried = new URL(audio.src, 'http://localhost');
    expect(retried.searchParams.get('format')).toBe('mp3');
    expect(retried.searchParams.get('maxBitRate')).toBe('320');
    expect(audio.playCount).toBe(2);
    expect(toasts.items).toEqual([]);

    audio.emit('error');

    expect(audio.playCount).toBe(2);
    expect(toasts.items.map((toast) => toast.message)).toEqual(['Could not play One.']);
  });

  it('stops at the end of the queue instead of wrapping around', () => {
    const { player, audio } = rig();
    player.play([item('tr_1'), item('tr_2')], 0);

    player.next();
    expect(player.queue.current?.id).toBe('tr_2');

    const pauses = audio.pauseCount;
    player.next();

    expect(player.queue.current?.id).toBe('tr_2');
    expect(audio.pauseCount).toBe(pauses + 1);
  });

  it('cycles repeat from off to all to song and back to off', () => {
    const { player } = rig();
    expect(player.repeat).toBe('off');

    player.cycleRepeat();
    expect(player.repeat).toBe('all');
    player.cycleRepeat();
    expect(player.repeat).toBe('song');
    player.cycleRepeat();
    expect(player.repeat).toBe('off');
  });

  it('wraps to the first track when the queue repeats', () => {
    const { player, audio } = rig();
    player.play([item('tr_1'), item('tr_2')], 0);
    player.cycleRepeat();

    player.next();
    expect(player.queue.current?.id).toBe('tr_2');

    player.next();
    expect(player.queue.current?.id).toBe('tr_1');
    expect(new URL(audio.src, 'http://localhost').searchParams.get('id')).toBe('tr_1');
  });

  it('wraps when the last track ends while the queue repeats', () => {
    const { player, audio } = rig();
    player.play([item('tr_1'), item('tr_2')], 1);
    player.cycleRepeat();
    const plays = audio.playCount;

    audio.emit('ended');

    expect(player.queue.current?.id).toBe('tr_1');
    expect(audio.playCount).toBe(plays + 1);
  });

  it('plays the same track again when it ends while one song repeats', () => {
    const { player, audio } = rig();
    player.play([item('tr_1'), item('tr_2')], 0);
    player.cycleRepeat();
    player.cycleRepeat();
    const plays = audio.playCount;

    audio.emit('ended');

    expect(player.queue.current?.id).toBe('tr_1');
    expect(new URL(audio.src, 'http://localhost').searchParams.get('id')).toBe('tr_1');
    expect(audio.playCount).toBe(plays + 1);
  });

  it('moves on with Next and Previous while one song repeats', () => {
    const { player } = rig();
    player.play([item('tr_1'), item('tr_2')], 0);
    player.cycleRepeat();
    player.cycleRepeat();

    player.next();
    expect(player.queue.current?.id).toBe('tr_2');

    player.previous();
    expect(player.queue.current?.id).toBe('tr_1');
  });

  it('keeps repeating one song after another song is chosen', () => {
    const { player, audio } = rig();
    player.play([item('tr_1'), item('tr_2')], 0);
    player.cycleRepeat();
    player.cycleRepeat();

    player.play([item('tr_3'), item('tr_4')], 0);
    audio.emit('ended');

    expect(player.repeat).toBe('song');
    expect(player.queue.current?.id).toBe('tr_3');
  });

  it('remembers shuffle and the repeat mode across restarts', () => {
    const storage = new FakeStorage();
    const first = rig(storage);
    first.player.toggleShuffle();
    first.player.cycleRepeat();

    const next = rig(storage);
    expect(next.player.shuffle).toBe(true);
    expect(next.player.repeat).toBe('all');
  });

  it('shuffles the upcoming tracks through the player and restores them', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const { player } = rig();
    player.play([item('a'), item('b'), item('c'), item('d')], 0);

    player.toggleShuffle();
    expect(player.shuffle).toBe(true);
    expect(player.queue.items.map((entry) => entry.id)).toEqual(['a', 'c', 'd', 'b']);

    player.toggleShuffle();
    expect(player.shuffle).toBe(false);
    expect(player.queue.items.map((entry) => entry.id)).toEqual(['a', 'b', 'c', 'd']);
    random.mockRestore();
  });

  it('restarts the current track past the restart point and steps back before it', () => {
    const { player, audio } = rig();
    player.play([item('tr_1'), item('tr_2')], 1);

    audio.currentTime = 30;
    player.previous();
    expect(player.queue.current?.id).toBe('tr_2');
    expect(new URL(audio.src, 'http://localhost').searchParams.get('id')).toBe('tr_2');

    audio.currentTime = 1;
    player.previous();

    expect(player.queue.current?.id).toBe('tr_1');
    expect(new URL(audio.src, 'http://localhost').searchParams.get('id')).toBe('tr_1');
  });

  it('moves playback to a position inside the track', () => {
    const { player, audio } = rig();
    player.play([item('tr_1')], 0);
    audio.duration = 100;

    player.seek(130);
    expect(audio.currentTime).toBe(100);

    player.seek(-5);
    expect(audio.currentTime).toBe(0);
  });

  it('asks for a track the server does not hold and plays it once it is there', async () => {
    const { player, audio, vendor, streams, states } = rig();
    vendor.acquisitions = [
      {
        id: 'ac_1',
        targetId: 'tr_9',
        state: 'downloading',
        priority: 'play',
        percent: 40
      }
    ];
    states.set('x_deezer_t_1', 'remote');

    player.play([item('x_deezer_t_1', { title: 'Catalog Song' })], 0);
    expect(player.progress).toBe('Searching sources');

    await vi.advanceTimersByTimeAsync(0);

    expect(audio.playCount).toBe(0);
    expect(vendor.acquireRequests).toEqual([{ ids: ['x_deezer_t_1'], priority: 'play' }]);
    expect(player.acquiringId).toBe('x_deezer_t_1');
    expect(player.progress).toBe('Downloading 40%');

    streams.emit(availabilityEvent('tr_9', 'local'));

    expect(audio.playCount).toBe(1);
    const url = new URL(audio.src, 'http://localhost');
    expect(url.searchParams.get('id')).toBe('tr_9');
    expect(player.progress).toBeNull();
    await vi.advanceTimersByTimeAsync(QUEUE_DECLARE_DELAY_MS);
  });

  it('plays what the server already has without asking for it', () => {
    const { player, audio, vendor, states } = rig();
    states.set('tr_1', 'cached');

    player.play([item('tr_1')], 0);

    expect(vendor.acquireRequests).toEqual([]);
    expect(audio.playCount).toBe(1);
  });

  it('reports a failed acquisition and plays nothing', async () => {
    const { player, audio, vendor, streams, states, toasts } = rig();
    states.set('x_deezer_t_1', 'remote');

    player.play([item('x_deezer_t_1', { title: 'Catalog Song' })], 0);
    await vi.advanceTimersByTimeAsync(0);
    expect(vendor.acquireRequests).toEqual([{ ids: ['x_deezer_t_1'], priority: 'play' }]);
    streams.emit(
      acquisitionEvent({
        acquisitionId: 'ac_1',
        targetId: 'x_deezer_t_1',
        state: 'failed',
        priority: 'play',
        failureReason: 'all-candidates-failed'
      })
    );

    expect(player.progress).toBe('Could not get this song: every source failed.');
    expect(audio.playCount).toBe(0);
    expect(toasts.items.map((toast) => toast.message)).toEqual([
      'Could not get this song: every source failed.'
    ]);
  });

  it('does not jump to a track the user asked for after the queue moved on', () => {
    const { player, audio, streams, states } = rig();
    states.set('x_deezer_t_1', 'remote');
    player.play([item('x_deezer_t_1'), item('tr_2')], 0);

    player.play([item('tr_2')], 0);
    streams.emit(availabilityEvent('x_deezer_t_1', 'local'));

    const url = new URL(audio.src, 'http://localhost');
    expect(url.searchParams.get('id')).toBe('tr_2');
    expect(audio.playCount).toBe(1);
  });

  it('keeps the prefetch state of the queue up to date from the stream', () => {
    const { player, streams } = rig();
    player.play([item('tr_1'), item('tr_2')], 0);

    streams.emit(prefetchEvent('tr_2', 'started', CLIENT));
    expect(player.prefetch.stateFor('tr_2').prefetch).toBe('started');

    streams.emit(availabilityEvent('tr_2', 'local'));
    expect(player.prefetch.stateFor('tr_2').availability).toBe('local');
  });
});
