/**
 * Tests for the server copy of the queue: what one save carries, when it is
 * sent, and what a failed save does (E-L-1).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FakeVendor } from '#lib/testing/player';
import type { QueueItem } from './queue.svelte';
import { SavedQueueSync, SAVE_QUEUE_DEBOUNCE_MS } from './queue-sync';
import type { SavedQueueSource } from './queue-sync';
import { PLAYBACK_QUEUE_LIMIT } from './restore';

/**
 * Builds a queue item.
 *
 * @param id The track's id.
 * @returns The item.
 */
function item(id: string): QueueItem {
  return { id, title: id };
}

/**
 * Builds a sync over a scripted vendor.
 *
 * @param source What the sync reads when it saves.
 * @returns The sync and the vendor it writes to.
 */
function rig(source: SavedQueueSource): { sync: SavedQueueSync; vendor: FakeVendor } {
  const vendor = new FakeVendor();
  const sync = new SavedQueueSync({ api: vendor, get: () => source });
  return { sync, vendor };
}

describe('saved queue sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes once for five changes in a row', async () => {
    let source: SavedQueueSource = { items: [], currentIndex: -1, positionSecs: 0, original: null };
    const vendor = new FakeVendor();
    const sync = new SavedQueueSync({ api: vendor, get: () => source });

    for (let index = 0; index < 5; index += 1) {
      source = {
        items: [item(`tr_${index}`)],
        currentIndex: 0,
        positionSecs: 0,
        original: null
      };
      sync.schedule();
      await vi.advanceTimersByTimeAsync(SAVE_QUEUE_DEBOUNCE_MS / 5);
    }

    expect(vendor.savedQueues).toEqual([]);

    await vi.advanceTimersByTimeAsync(SAVE_QUEUE_DEBOUNCE_MS);

    expect(vendor.savedQueues).toHaveLength(1);
    expect(vendor.savedQueues[0].ids).toEqual(['tr_4']);
  });

  it('saves the trimmed queue, its current entry and the position in milliseconds', async () => {
    const items = Array.from({ length: 1200 }, (_, index) => item(`tr_${index}`));
    const { sync, vendor } = rig({ items, currentIndex: 600, positionSecs: 3.5, original: null });

    sync.schedule();
    await vi.advanceTimersByTimeAsync(SAVE_QUEUE_DEBOUNCE_MS);

    const [saved] = vendor.savedQueues;
    expect(saved.ids).toHaveLength(PLAYBACK_QUEUE_LIMIT);
    expect(saved.ids[0]).toBe('tr_100');
    expect(saved.current).toBe('tr_600');
    expect(saved.positionMs).toBe(3500);
  });

  it('saves an empty queue with no ids, which deletes the stored one', async () => {
    const { sync, vendor } = rig({ items: [], currentIndex: -1, positionSecs: 0, original: null });

    sync.schedule();
    await vi.advanceTimersByTimeAsync(SAVE_QUEUE_DEBOUNCE_MS);

    expect(vendor.savedQueues).toEqual([{ ids: [], current: null, positionMs: 0 }]);
  });

  it('writes a pending save at once when the page goes away', () => {
    const { sync, vendor } = rig({
      items: [item('tr_1')],
      currentIndex: 0,
      positionSecs: 12,
      original: null
    });

    sync.schedule();
    sync.flush();

    expect(vendor.savedQueues).toEqual([{ ids: ['tr_1'], current: 'tr_1', positionMs: 12000 }]);
  });

  it('swallows a failed save and sends the queue again on the next change', async () => {
    const { sync, vendor } = rig({
      items: [item('tr_1')],
      currentIndex: 0,
      positionSecs: 1,
      original: null
    });
    vendor.saveQueueFailure = new Error('unreachable');

    sync.schedule();
    await vi.advanceTimersByTimeAsync(SAVE_QUEUE_DEBOUNCE_MS);
    expect(vendor.savedQueues).toHaveLength(1);

    vendor.saveQueueFailure = null;
    sync.schedule();
    await vi.advanceTimersByTimeAsync(SAVE_QUEUE_DEBOUNCE_MS);

    expect(vendor.savedQueues).toHaveLength(2);
  });
});
