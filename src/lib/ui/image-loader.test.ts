/**
 * Tests for the image gate: the concurrency cap, cancellation, and the memory of
 * what already loaded.
 */
import { describe, expect, it } from 'vitest';

import { createImageLoader } from './image-loader';

/** An image element whose events the test fires by hand. */
interface FakeImage {
  /** Set by the loader. */
  decoding: string;
  /** Set by the loader. */
  onload: (() => void) | null;
  /** Set by the loader. */
  onerror: (() => void) | null;
  /** The URL the loader asked for, or empty once the image settled. */
  src: string;
}

/**
 * Builds a loader whose images the test drives.
 *
 * @param max The concurrency to test.
 * @returns The loader, every image it created, and the helpers that observe and
 * finish them.
 */
function harness(max: number) {
  const created: FakeImage[] = [];
  const loader = createImageLoader(max, () => {
    const image: FakeImage = { decoding: '', onload: null, onerror: null, src: '' };
    created.push(image);
    return image as unknown as HTMLImageElement;
  });

  return {
    loader,
    created,
    /** The images that started and have not settled. */
    inFlight: () => created.filter((image) => image.src !== '' && image.onload !== null).length,
    /** Fires the load or error event of one started image. */
    settle: (index: number, ok = true) => {
      const image = created[index];
      const handler = ok ? image.onload : image.onerror;
      image.onload = null;
      image.onerror = null;
      image.src = '';
      handler?.();
    }
  };
}

describe('the image gate', () => {
  it('never runs more images than its limit', async () => {
    const gate = harness(3);
    const loads = ['a', 'b', 'c', 'd', 'e'].map((url) => gate.loader.load(url));

    expect(gate.created).toHaveLength(3);
    expect(gate.inFlight()).toBe(3);

    gate.settle(0);
    await Promise.resolve();
    expect(gate.created).toHaveLength(4);
    expect(gate.inFlight()).toBe(3);

    for (let index = 1; index < gate.created.length; index += 1) {
      gate.settle(index);
    }
    await expect(Promise.all(loads.slice(0, 4).map((load) => load.done))).resolves.toEqual([
      true,
      true,
      true,
      true
    ]);
  });

  it('never starts a queued load that was cancelled', async () => {
    const gate = harness(2);
    gate.loader.load('a');
    gate.loader.load('b');
    const queued = gate.loader.load('c');

    queued.cancel();
    await expect(queued.done).resolves.toBe(false);

    gate.settle(0);
    gate.settle(1);
    await Promise.resolve();
    expect(gate.created).toHaveLength(2);
    expect(gate.loader.isLoaded('c')).toBe(false);
  });

  it('gives a cancelled running load its slot to the next one', async () => {
    const gate = harness(1);
    const first = gate.loader.load('a');
    const second = gate.loader.load('b');

    first.cancel();
    await expect(first.done).resolves.toBe(false);
    expect(gate.created).toHaveLength(2);
    expect(gate.created[0].src).toBe('');
    expect(gate.created[1].src).toBe('b');

    gate.settle(1);
    await expect(second.done).resolves.toBe(true);
  });

  it('answers a URL that already loaded without taking a slot', async () => {
    const gate = harness(1);
    const first = gate.loader.load('a');
    gate.settle(0);
    await expect(first.done).resolves.toBe(true);

    const busy = gate.loader.load('b');
    const again = gate.loader.load('a');
    await expect(again.done).resolves.toBe(true);
    expect(gate.created).toHaveLength(2);
    expect(gate.loader.isLoaded('a')).toBe(true);

    gate.settle(1);
    await expect(busy.done).resolves.toBe(true);
  });

  it('releases the slot on an error and does not remember it', async () => {
    const gate = harness(1);
    const failed = gate.loader.load('a');
    const next = gate.loader.load('b');

    gate.settle(0, false);
    await expect(failed.done).resolves.toBe(false);
    expect(gate.created).toHaveLength(2);
    expect(gate.loader.isLoaded('a')).toBe(false);

    gate.settle(1);
    await expect(next.done).resolves.toBe(true);
  });
});
