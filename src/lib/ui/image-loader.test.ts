/**
 * Tests for the image gate: the concurrency cap, cancellation, and the memory of
 * what loaded or failed, which is what a revisit draws from.
 */
import { describe, expect, it } from 'vitest';

import { IMAGE_FAILURE_TTL_MS, createImageLoader } from './image-loader';

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

/** A storage that keeps its entries in memory, like `sessionStorage`. */
function memoryStorage(): Storage {
  const entries = new Map<string, string>();
  return {
    get length(): number {
      return entries.size;
    },
    clear: () => entries.clear(),
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => void entries.delete(key),
    setItem: (key: string, value: string) => void entries.set(key, value)
  };
}

/**
 * Builds a loader whose images the test drives.
 *
 * @param max The concurrency to test.
 * @param options The storage and the clock the loader should use.
 * @returns The loader, every image it created, and the helpers that observe and
 * finish them.
 */
function harness(max: number, options: { storage?: Storage | null; now?: () => number } = {}) {
  const created: FakeImage[] = [];
  const loader = createImageLoader(max, {
    makeImage: () => {
      const image: FakeImage = { decoding: '', onload: null, onerror: null, src: '' };
      created.push(image);
      return image as unknown as HTMLImageElement;
    },
    storage: options.storage ?? null,
    now: options.now
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

  it('remembers a failure and answers it without starting an image', async () => {
    const gate = harness(1);
    const failed = gate.loader.load('a');
    gate.settle(0, false);
    await expect(failed.done).resolves.toBe(false);
    expect(gate.loader.isLoaded('a')).toBe(false);
    expect(gate.loader.isFailed('a')).toBe(true);

    const again = gate.loader.load('a');
    await expect(again.done).resolves.toBe(false);
    expect(gate.created).toHaveLength(1);
  });

  it('forgets a failure once its window passed', async () => {
    let at = 0;
    const gate = harness(1, { now: () => at });
    const failed = gate.loader.load('a');
    gate.settle(0, false);
    await expect(failed.done).resolves.toBe(false);

    at = IMAGE_FAILURE_TTL_MS - 1;
    expect(gate.loader.isFailed('a')).toBe(true);

    at = IMAGE_FAILURE_TTL_MS;
    expect(gate.loader.isFailed('a')).toBe(false);
    gate.loader.load('a');
    expect(gate.created).toHaveLength(2);
  });

  it('does not count a cancelled load as a failure', async () => {
    const gate = harness(1);
    const cancelled = gate.loader.load('a');
    cancelled.cancel();
    await expect(cancelled.done).resolves.toBe(false);

    expect(gate.loader.isFailed('a')).toBe(false);
    expect(gate.created).toHaveLength(1);
  });

  it('remembers a failure the caller reports for an image it drew itself', async () => {
    const gate = harness(1);
    gate.loader.reportFailure('a');

    expect(gate.loader.isFailed('a')).toBe(true);
    await expect(gate.loader.load('a').done).resolves.toBe(false);
    expect(gate.created).toHaveLength(0);
  });

  it('carries the loaded URLs into the next page load', async () => {
    const storage = memoryStorage();
    const before = harness(1, { storage });
    const load = before.loader.load('a');
    before.settle(0);
    await expect(load.done).resolves.toBe(true);

    const after = harness(1, { storage });
    expect(after.loader.isLoaded('a')).toBe(true);
    await expect(after.loader.load('a').done).resolves.toBe(true);
    expect(after.created).toHaveLength(0);
  });

  it('carries an unexpired failure into the next page load', async () => {
    const storage = memoryStorage();
    let at = 0;
    const before = harness(1, { storage, now: () => at });
    before.loader.reportFailure('a');

    at = IMAGE_FAILURE_TTL_MS / 2;
    const still = harness(1, { storage, now: () => at });
    expect(still.loader.isFailed('a')).toBe(true);
    expect(still.created).toHaveLength(0);

    at = IMAGE_FAILURE_TTL_MS + 1;
    const later = harness(1, { storage, now: () => at });
    expect(later.loader.isFailed('a')).toBe(false);
  });
});
