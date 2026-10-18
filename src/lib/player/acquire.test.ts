/**
 * Tests for the acquisition flow: the labels the user sees and the play the
 * flow starts, fed with the events a server would publish.
 */
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { acquisitionEvent, availabilityEvent } from '#lib/testing/event-stream';
import { FakeVendor } from '#lib/testing/player';
import { SubsonicError } from '#lib/subsonic/client';
import { AcquireFlow } from './acquire.svelte';
import type { AcquireFlowOptions } from './acquire.svelte';

/** A flow over scripted doubles. */
interface Rig {
  flow: AcquireFlow;
  vendor: FakeVendor;
  ready: Mock<(playId: string) => void>;
  failed: Mock<(message: string) => void>;
}

/**
 * Builds a flow over a scripted vendor.
 *
 * @returns The flow and the doubles it reports to.
 */
function rig(): Rig {
  const vendor = new FakeVendor();
  const ready = vi.fn();
  const failed = vi.fn();
  const options: AcquireFlowOptions = { api: vendor, onReady: ready, onFailed: failed };
  const flow = new AcquireFlow(options);
  return { flow, vendor, ready, failed };
}

describe('acquisition flow', () => {
  it('searches, downloads and plays the id the acquisition produced', async () => {
    const { flow, vendor, ready, failed } = rig();
    vendor.acquisitions = [
      {
        id: 'ac_1',
        targetId: 'tr_9',
        state: 'queued',
        priority: 'play'
      }
    ];

    await flow.request('x_deezer_t_1');
    expect(vendor.acquireRequests).toEqual([{ ids: ['x_deezer_t_1'], priority: 'play' }]);
    expect(flow.label).toBe('Searching sources');

    flow.apply(
      acquisitionEvent({
        acquisitionId: 'ac_1',
        targetId: 'tr_9',
        state: 'searching',
        priority: 'play'
      })
    );
    expect(flow.label).toBe('Searching sources');

    flow.apply(
      acquisitionEvent({
        acquisitionId: 'ac_1',
        targetId: 'tr_9',
        state: 'downloading',
        priority: 'play',
        percent: 40
      })
    );
    expect(flow.label).toBe('Downloading 40%');

    flow.apply(availabilityEvent('tr_9', 'local'));

    expect(flow.label).toBe('Ready');
    expect(ready).toHaveBeenCalledWith('tr_9');
    expect(failed).not.toHaveBeenCalled();
  });

  it('plays at once when the request is already satisfied', async () => {
    const { flow, vendor, ready } = rig();
    vendor.acquisitions = [{ id: 'ac_2', targetId: 'tr_4', state: 'completed', priority: 'play' }];

    await flow.request('x_deezer_t_4');

    expect(flow.label).toBe('Ready');
    expect(ready).toHaveBeenCalledWith('tr_4');
  });

  it('names the reason when the acquisition fails, and plays nothing', async () => {
    const { flow, ready, failed } = rig();

    await flow.request('tr_1');
    flow.apply(
      acquisitionEvent({
        acquisitionId: 'ac_1',
        targetId: 'tr_1',
        state: 'failed',
        priority: 'play',
        failureReason: 'no-candidates'
      })
    );

    expect(flow.label).toBe('Could not get this song: no source has it.');
    expect(failed).toHaveBeenCalledWith('Could not get this song: no source has it.');
    expect(ready).not.toHaveBeenCalled();
  });

  it('reports a cancellation without calling it a failure', async () => {
    const { flow, failed } = rig();

    await flow.request('tr_1');
    flow.apply(
      acquisitionEvent({
        acquisitionId: 'ac_1',
        targetId: 'tr_1',
        state: 'cancelled',
        priority: 'play',
        failureReason: 'cancelled'
      })
    );

    expect(flow.label).toBe('Cancelled');
    expect(failed).not.toHaveBeenCalled();
  });

  it('reports an unreachable server as an unreachable download service', async () => {
    const { flow, vendor, failed } = rig();
    vendor.failure = new Error('unreachable');

    await flow.request('tr_1');

    expect(flow.label).toBe('Could not get this song: the download service is unreachable.');
    expect(failed).toHaveBeenCalledTimes(1);
  });

  it('reports a refused acquisition as a permission problem', async () => {
    const { flow, vendor } = rig();
    vendor.failure = new SubsonicError({ code: 50, message: 'Not authorized.' });

    await flow.request('tr_1');

    expect(flow.label).toBe('Could not get this song: you may not acquire songs.');
  });

  it('ignores the events of another acquisition', async () => {
    const { flow, ready } = rig();
    await flow.request('tr_1');
    const before = flow.label;

    flow.apply(
      acquisitionEvent({
        acquisitionId: 'ac_9',
        targetId: 'tr_9',
        state: 'downloading',
        priority: 'play',
        percent: 90
      })
    );

    expect(flow.label).toBe(before);
    expect(ready).not.toHaveBeenCalled();
  });

  it('replaces the event state with what the server reports after lost events', async () => {
    const { flow, vendor, ready } = rig();
    await flow.request('x_deezer_t_1');
    vendor.availability = [{ id: 'tr_9', state: 'cached', inLibrary: false }];

    await flow.resync();

    expect(vendor.availabilityReads).toEqual([['x_deezer_t_1']]);
    expect(ready).toHaveBeenCalledWith('tr_9');
    expect(flow.label).toBe('Ready');
  });

  it('keeps waiting when the server still does not have the track', async () => {
    const { flow, vendor, ready } = rig();
    await flow.request('x_deezer_t_1');
    vendor.availability = [{ id: 'x_deezer_t_1', state: 'remote', inLibrary: false }];

    await flow.resync();

    expect(ready).not.toHaveBeenCalled();
    expect(flow.label).toBe('Searching sources');
  });

  it('stops following once the user asks for something else', async () => {
    const { flow, ready } = rig();
    await flow.request('tr_1');

    flow.clear();
    flow.apply(
      acquisitionEvent({
        acquisitionId: 'ac_1',
        targetId: 'tr_1',
        state: 'downloading',
        priority: 'play',
        percent: 90
      })
    );

    expect(flow.label).toBeNull();
    expect(flow.requestedId).toBeNull();
    expect(ready).not.toHaveBeenCalled();
  });
});
