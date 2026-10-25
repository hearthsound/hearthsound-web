/**
 * Tests for the play queue: where the index lands when items are removed,
 * moved, or stepped through.
 */
import { describe, expect, it, vi } from 'vitest';

import { QueueStore, RESTART_POSITION_SECS } from './queue.svelte';
import type { QueueItem } from './queue.svelte';

/**
 * Builds a queue item.
 *
 * @param id The track's id.
 * @returns The item.
 */
function item(id: string): QueueItem {
  return { id, title: id };
}

/** A queue of three tracks, playing the first. */
function queueOf(...ids: string[]): QueueStore {
  const queue = new QueueStore();
  queue.play(
    ids.map((id) => item(id)),
    0
  );
  return queue;
}

describe('play queue', () => {
  it('starts at the item it was asked to start at', () => {
    const queue = queueOf('a', 'b', 'c');

    queue.play([item('x'), item('y')], 1);

    expect(queue.current?.id).toBe('y');
    expect(queue.items.map((entry) => entry.id)).toEqual(['x', 'y']);
  });

  it('clamps a start index into the list', () => {
    const queue = new QueueStore();

    queue.play([item('a')], 7);
    expect(queue.current?.id).toBe('a');

    queue.play([], 0);
    expect(queue.current).toBeNull();
    expect(queue.currentIndex).toBe(-1);
  });

  it('keeps the index on the same track when an earlier item is removed', () => {
    const queue = queueOf('a', 'b', 'c');
    queue.next();

    queue.remove(0);

    expect(queue.current?.id).toBe('b');
    expect(queue.items.map((entry) => entry.id)).toEqual(['b', 'c']);
  });

  it('hands over to the next item when the playing one is removed', () => {
    const queue = queueOf('a', 'b', 'c');

    queue.remove(0);

    expect(queue.current?.id).toBe('b');
    expect(queue.currentIndex).toBe(0);
  });

  it('moves to the new last item when the last playing item is removed', () => {
    const queue = queueOf('a', 'b');
    queue.next();

    queue.remove(1);

    expect(queue.current?.id).toBe('a');

    queue.remove(0);

    expect(queue.current).toBeNull();
    expect(queue.currentIndex).toBe(-1);
  });

  it('leaves the index alone when a later item is removed', () => {
    const queue = queueOf('a', 'b', 'c');

    queue.remove(2);

    expect(queue.current?.id).toBe('a');
    expect(queue.currentIndex).toBe(0);
  });

  it('ignores a removal outside the queue', () => {
    const queue = queueOf('a');

    queue.remove(3);

    expect(queue.items).toHaveLength(1);
  });

  it('follows the playing track when it is moved', () => {
    const queue = queueOf('a', 'b', 'c');

    queue.move(0, 2);

    expect(queue.items.map((entry) => entry.id)).toEqual(['b', 'c', 'a']);
    expect(queue.current?.id).toBe('a');
    expect(queue.currentIndex).toBe(2);
  });

  it('keeps the same track playing when another one moves past it', () => {
    const queue = queueOf('a', 'b', 'c');
    queue.next();

    queue.move(2, 0);

    expect(queue.items.map((entry) => entry.id)).toEqual(['c', 'a', 'b']);
    expect(queue.current?.id).toBe('b');
    expect(queue.currentIndex).toBe(2);

    queue.move(0, 2);
    expect(queue.current?.id).toBe('b');
    expect(queue.currentIndex).toBe(1);
  });

  it('ignores a move that changes nothing', () => {
    const queue = queueOf('a', 'b');

    queue.move(1, 1);
    queue.move(0, 5);

    expect(queue.items.map((entry) => entry.id)).toEqual(['a', 'b']);
  });

  it('puts an item next in line, or starts the queue with it', () => {
    const queue = queueOf('a', 'b');

    queue.playNext(item('x'));
    expect(queue.items.map((entry) => entry.id)).toEqual(['a', 'x', 'b']);

    const empty = new QueueStore();
    empty.playNext(item('only'));
    expect(empty.current?.id).toBe('only');
  });

  it('starts an empty queue with the first appended item', () => {
    const queue = new QueueStore();

    queue.append([item('a'), item('b')]);

    expect(queue.items).toHaveLength(2);
    expect(queue.current?.id).toBe('a');
  });

  it('stops advancing at the end of the queue', () => {
    const queue = queueOf('a', 'b');

    expect(queue.next()?.id).toBe('b');
    expect(queue.next()).toBeNull();
    expect(queue.current?.id).toBe('b');
  });

  it('steps back, and restarts the track that plays past the restart position', () => {
    const queue = queueOf('a', 'b');
    queue.next();

    expect(queue.previous(0)?.id).toBe('a');
    expect(queue.currentIndex).toBe(0);

    expect(queue.previous(RESTART_POSITION_SECS + 1)?.id).toBe('a');
    expect(queue.currentIndex).toBe(0);
  });

  it('restarts the first track instead of stepping past it', () => {
    const queue = queueOf('a', 'b');

    expect(queue.previous(0)?.id).toBe('a');
    expect(queue.currentIndex).toBe(0);
  });

  it('shuffles the tracks after the current one and restores their order', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const queue = queueOf('a', 'b', 'c', 'd');

    queue.setShuffle(true);

    expect(queue.shuffle).toBe(true);
    expect(queue.items.map((entry) => entry.id)).toEqual(['a', 'c', 'd', 'b']);
    expect(queue.current?.id).toBe('a');
    expect(queue.currentIndex).toBe(0);

    queue.setShuffle(false);

    expect(queue.shuffle).toBe(false);
    expect(queue.items.map((entry) => entry.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(queue.current?.id).toBe('a');
    random.mockRestore();
  });

  it('moves the current track to the front when shuffling mid-queue', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const queue = queueOf('a', 'b', 'c', 'd');
    queue.next();

    queue.setShuffle(true);

    expect(queue.items.map((entry) => entry.id)).toEqual(['b', 'c', 'd', 'a']);
    expect(queue.currentIndex).toBe(0);
    expect(queue.current?.id).toBe('b');

    queue.setShuffle(false);
    expect(queue.items.map((entry) => entry.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(queue.currentIndex).toBe(1);
    random.mockRestore();
  });

  it('appends a track added while shuffled to both orders', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const queue = queueOf('a', 'b', 'c');
    queue.setShuffle(true);
    expect(queue.items.map((entry) => entry.id)).toEqual(['a', 'c', 'b']);

    queue.append([item('d')]);

    expect(queue.items.map((entry) => entry.id)).toEqual(['a', 'c', 'b', 'd']);
    queue.setShuffle(false);
    expect(queue.items.map((entry) => entry.id)).toEqual(['a', 'b', 'c', 'd']);
    random.mockRestore();
  });

  it('drops a track removed while shuffled from both orders', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    const queue = queueOf('a', 'b', 'c', 'd');
    queue.setShuffle(true);
    expect(queue.items.map((entry) => entry.id)).toEqual(['a', 'c', 'd', 'b']);

    queue.remove(1);

    expect(queue.items.map((entry) => entry.id)).toEqual(['a', 'd', 'b']);
    queue.setShuffle(false);
    expect(queue.items.map((entry) => entry.id)).toEqual(['a', 'b', 'd']);
    random.mockRestore();
  });

  it('goes back only through shuffled tracks when a list starts shuffled mid-way', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const queue = new QueueStore();
    queue.setShuffle(true);
    queue.play([item('a'), item('b'), item('c'), item('d')], 2);

    expect(queue.current?.id).toBe('c');
    queue.next();
    queue.previous(0);
    expect(queue.current?.id).toBe('c');
    queue.previous(0);
    expect(queue.current?.id).toBe('c');
    random.mockRestore();
  });

  it('removes one of two entries with the same id and keeps the other', () => {
    const queue = new QueueStore();
    const first = item('tr_1');
    const second = item('tr_1');
    const other = item('tr_2');
    queue.setShuffle(true);
    queue.restore([first, second, other], 0, [first, second, other]);

    queue.remove(0);

    expect(queue.items).toEqual([second, other]);
    expect(queue.originalItems).toEqual([second, other]);

    queue.setShuffle(false);

    expect(queue.items).toEqual([second, other]);
    expect(queue.currentIndex).toBe(0);
    expect(queue.current?.id).toBe('tr_1');
  });

  it('names the items after the current one as the following list', () => {
    const queue = queueOf('a', 'b', 'c');

    expect(queue.following.map((entry) => entry.id)).toEqual(['b', 'c']);

    queue.next();
    expect(queue.following.map((entry) => entry.id)).toEqual(['c']);

    queue.next();
    expect(queue.following).toEqual([]);
  });

  it('shuffles each new round when a shuffled queue starts over', () => {
    const random = vi.spyOn(Math, 'random');
    const queue = new QueueStore();
    queue.play([item('a'), item('b'), item('c'), item('d')], 0);
    // A random value just under 1 leaves the first shuffle in its order; 0 then
    // moves every track, so the second round must differ.
    random.mockReturnValue(0.99);
    queue.setShuffle(true);
    const firstRound = queue.items.map((entry) => entry.id);

    random.mockReturnValue(0);
    queue.rewind();

    expect(queue.currentIndex).toBe(0);
    expect(queue.items.map((entry) => entry.id)).not.toEqual(firstRound);
    expect([...queue.items.map((entry) => entry.id)].sort()).toEqual(['a', 'b', 'c', 'd']);
    random.mockRestore();
  });
});
