/**
 * Tests for the connection store's Retry probe: what it asks, what clears the
 * banner, and that a second Retry does not start a second probe.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConnectionStore } from './connection.svelte';

describe('connection retry', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('clears the banner when the server answers, whatever it answers', async () => {
    const store = new ConnectionStore();
    store.failed();
    const fetch = vi.fn(async () => new Response(null, { status: 503 }));
    vi.stubGlobal('fetch', fetch);

    await store.retry();

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/setup',
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' })
    );
    expect(store.unreachable).toBe(false);
    expect(store.retrying).toBe(false);
  });

  it('keeps the banner when the probe cannot reach the server', async () => {
    const store = new ConnectionStore();
    store.failed();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('network');
      })
    );

    await store.retry();

    expect(store.unreachable).toBe(true);
    expect(store.retrying).toBe(false);
  });

  it('probes once while a probe is in flight', async () => {
    const store = new ConnectionStore();
    const gate = Promise.withResolvers<Response>();
    const fetch = vi.fn(() => gate.promise);
    vi.stubGlobal('fetch', fetch);

    const first = store.retry();
    const second = store.retry();

    expect(store.retrying).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);

    gate.resolve(new Response(null, { status: 200 }));
    await Promise.all([first, second]);

    expect(store.unreachable).toBe(false);
    expect(store.retrying).toBe(false);
  });
});
