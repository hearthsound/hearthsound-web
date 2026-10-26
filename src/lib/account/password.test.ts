/**
 * Tests for the password change: the body the form sends, the 204 success, a
 * `wrong-password` refusal that keeps its code, and a network fallback.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nativeClient } from '#lib/api/native';

import { changePassword } from './password';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('changing the password', () => {
  it('posts both passwords', async () => {
    const post = vi.spyOn(nativeClient, 'POST').mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 204 })
    } as never);

    expect(await changePassword('old-one-1', 'new-one-22')).toEqual({ ok: true });
    expect(post).toHaveBeenCalledWith('/api/v1/me/password', {
      body: { currentPassword: 'old-one-1', newPassword: 'new-one-22' }
    });
  });

  it('keeps the code of a refused change', async () => {
    vi.spyOn(nativeClient, 'POST').mockResolvedValue({
      data: undefined,
      error: { code: 'wrong-password', detail: 'The current password is not correct.' },
      response: new Response(null, { status: 403 })
    } as never);

    expect(await changePassword('wrong', 'new-one-22')).toEqual({
      ok: false,
      message: 'The current password is not correct.',
      code: 'wrong-password'
    });
  });

  it('answers a refusal when the request never reached the server', async () => {
    vi.spyOn(nativeClient, 'POST').mockRejectedValue(new Error('offline'));

    expect(await changePassword('old-one-1', 'new-one-22')).toEqual({
      ok: false,
      message: 'Could not change this password.',
      code: null
    });
  });

  it('falls back to its own sentence when the refusal carries no detail', async () => {
    vi.spyOn(nativeClient, 'POST').mockResolvedValue({
      data: undefined,
      error: undefined,
      response: new Response(null, { status: 500 })
    } as never);

    expect(await changePassword('old-one-1', 'new-one-22')).toEqual({
      ok: false,
      message: 'Could not change the password.',
      code: null
    });
  });
});
