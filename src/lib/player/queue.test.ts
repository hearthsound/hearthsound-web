/**
 * Tests for the play queue: where the index lands when items are removed,
 * moved, or stepped through.
 */
import { describe, expect, it } from 'vitest';

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

  it('names the items after the current one as the following list', () => {
    const queue = queueOf('a', 'b', 'c');

    expect(queue.following.map((entry) => entry.id)).toEqual(['b', 'c']);

    queue.next();
    expect(queue.following.map((entry) => entry.id)).toEqual(['c']);

    queue.next();
    expect(queue.following).toEqual([]);
  });
});
