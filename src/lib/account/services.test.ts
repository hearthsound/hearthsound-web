/**
 * Tests for the service calls: a request the network refuses answers the
 * sentence the page shows, so a command never stays busy and never rejects.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nativeClient } from '#lib/api/native';

import { beginServiceLink, listServices, saveServiceConfig, unlinkService } from './services';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Makes every request of the client reject, as a lost network does.
 *
 * @returns Nothing.
 */
function offline(): void {
  vi.spyOn(nativeClient, 'GET').mockRejectedValue(new Error('offline'));
  vi.spyOn(nativeClient, 'PUT').mockRejectedValue(new Error('offline'));
  vi.spyOn(nativeClient, 'POST').mockRejectedValue(new Error('offline'));
  vi.spyOn(nativeClient, 'DELETE').mockRejectedValue(new Error('offline'));
}

describe('service calls that never reached the server', () => {
  it('answers a refusal for every call instead of rejecting', async () => {
    offline();

    expect(await listServices()).toEqual({
      ok: false,
      message: 'Could not read the connected services.'
    });
    expect(await saveServiceConfig('listenbrainz', {})).toEqual({
      ok: false,
      message: 'Could not save this configuration.'
    });
    expect(await beginServiceLink('listenbrainz')).toEqual({
      ok: false,
      message: 'Could not start the link.'
    });
    expect(await unlinkService('listenbrainz')).toEqual({
      ok: false,
      message: 'Could not disconnect this service.'
    });
  });
});
