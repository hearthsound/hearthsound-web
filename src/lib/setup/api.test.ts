/**
 * Tests for the setup calls: the status read, the administrator the setup link
 * creates, and the pre-flight check that says whether a link is still live.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nativeClient } from '#lib/api/native';

import { checkSetupToken } from './api';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the setup link check', () => {
  it('reports the live link as valid without spending it', async () => {
    const post = vi.spyOn(nativeClient, 'POST').mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 204 })
    } as never);

    expect(await checkSetupToken('tok')).toBe('valid');
    expect(post).toHaveBeenCalledWith('/api/v1/setup/check', { body: { token: 'tok' } });
  });

  it('reports a refused link as invalid', async () => {
    vi.spyOn(nativeClient, 'POST').mockResolvedValue({
      data: undefined,
      error: { code: 'invalid-setup-token', detail: 'The setup link is not valid.' },
      response: new Response(null, { status: 403 })
    } as never);

    expect(await checkSetupToken('nope')).toBe('invalid');
  });

  it('keeps the form when the answer says neither', async () => {
    vi.spyOn(nativeClient, 'POST').mockResolvedValue({
      data: undefined,
      error: { code: 'conflict' },
      response: new Response(null, { status: 409 })
    } as never);

    expect(await checkSetupToken('tok')).toBe('unknown');
  });

  it('keeps the form when the server could not be asked', async () => {
    vi.spyOn(nativeClient, 'POST').mockRejectedValue(new Error('offline'));

    expect(await checkSetupToken('tok')).toBe('unknown');
  });
});
