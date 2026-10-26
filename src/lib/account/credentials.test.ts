/**
 * Tests for the credential calls: each hits its own method and path, a created
 * credential carries its secret, a revoked one treats 204 as success, and the
 * two pure helpers word the row and the name rule.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nativeClient } from '#lib/api/native';

import {
  createdText,
  createApiKey,
  createAppPassword,
  credentialLabels,
  credentialNameProblem,
  lastUsedText,
  listApiKeys,
  listAppPasswords,
  revokeApiKey,
  revokeAppPassword
} from './credentials';

afterEach(() => {
  vi.restoreAllMocks();
});

/** One API key as the server lists it. */
const KEY = {
  id: 'ak_1',
  name: 'Laptop',
  prefix: 'hs_abc',
  createdAt: Date.UTC(2026, 0, 2),
  lastUsedAt: null
};

/** One app password as the server lists it. */
const PASSWORD = { id: 'ap_1', name: 'Phone', createdAt: Date.UTC(2026, 0, 3), lastUsedAt: null };

describe('the credential calls', () => {
  it('reads the API keys from their route', async () => {
    const get = vi.spyOn(nativeClient, 'GET').mockResolvedValue({
      data: [KEY],
      response: new Response()
    } as never);

    expect(await listApiKeys()).toEqual({ ok: true, value: [KEY] });
    expect(get).toHaveBeenCalledWith('/api/v1/me/api-keys');
  });

  it('reads the app passwords from their route', async () => {
    const get = vi.spyOn(nativeClient, 'GET').mockResolvedValue({
      data: [PASSWORD],
      response: new Response()
    } as never);

    expect(await listAppPasswords()).toEqual({ ok: true, value: [PASSWORD] });
    expect(get).toHaveBeenCalledWith('/api/v1/me/app-passwords');
  });

  it('creates an API key and answers its secret', async () => {
    const created = { ...KEY, secret: 'hs_abcdef' };
    const post = vi.spyOn(nativeClient, 'POST').mockResolvedValue({
      data: created,
      response: new Response(null, { status: 201 })
    } as never);

    expect(await createApiKey('Laptop')).toEqual({ ok: true, value: created });
    expect(post).toHaveBeenCalledWith('/api/v1/me/api-keys', { body: { name: 'Laptop' } });
  });

  it('creates an app password and answers its secret', async () => {
    const created = { ...PASSWORD, secret: 'appsecret' };
    const post = vi.spyOn(nativeClient, 'POST').mockResolvedValue({
      data: created,
      response: new Response(null, { status: 201 })
    } as never);

    expect(await createAppPassword('Phone')).toEqual({ ok: true, value: created });
    expect(post).toHaveBeenCalledWith('/api/v1/me/app-passwords', { body: { name: 'Phone' } });
  });

  it('revokes each kind and treats 204 as success', async () => {
    const remove = vi.spyOn(nativeClient, 'DELETE').mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 204 })
    } as never);

    expect(await revokeApiKey('ak_1')).toEqual({ ok: true, value: undefined });
    expect(await revokeAppPassword('ap_1')).toEqual({ ok: true, value: undefined });
    expect(remove).toHaveBeenCalledWith('/api/v1/me/api-keys/{id}', {
      params: { path: { id: 'ak_1' } }
    });
    expect(remove).toHaveBeenCalledWith('/api/v1/me/app-passwords/{id}', {
      params: { path: { id: 'ap_1' } }
    });
  });

  it('shows the problem a refused revoke answered with', async () => {
    vi.spyOn(nativeClient, 'DELETE').mockResolvedValue({
      data: undefined,
      error: { code: 'not-found', detail: 'No such key of the caller’s.' },
      response: new Response(null, { status: 404 })
    } as never);

    expect(await revokeApiKey('ak_1')).toEqual({
      ok: false,
      message: 'No such key of the caller’s.'
    });
  });

  it('answers a refusal for a request that never reached the server', async () => {
    vi.spyOn(nativeClient, 'GET').mockRejectedValue(new Error('offline'));
    vi.spyOn(nativeClient, 'POST').mockRejectedValue(new Error('offline'));
    vi.spyOn(nativeClient, 'DELETE').mockRejectedValue(new Error('offline'));

    expect(await listApiKeys()).toEqual({ ok: false, message: 'Could not read the API keys.' });
    expect(await listAppPasswords()).toEqual({
      ok: false,
      message: 'Could not read the app passwords.'
    });
    expect(await createApiKey('x')).toEqual({
      ok: false,
      message: 'Could not create this API key.'
    });
    expect(await createAppPassword('x')).toEqual({
      ok: false,
      message: 'Could not create this app password.'
    });
    expect(await revokeApiKey('ak_1')).toEqual({
      ok: false,
      message: 'Could not revoke this API key.'
    });
    expect(await revokeAppPassword('ap_1')).toEqual({
      ok: false,
      message: 'Could not revoke this app password.'
    });
  });
});

describe('the name rule', () => {
  it('asks for a name and refuses one over the cap', () => {
    expect(credentialNameProblem('')).toBe('Choose a name.');
    expect(credentialNameProblem('x'.repeat(64))).toBeNull();
    expect(credentialNameProblem('x'.repeat(65))).toBe(
      'A credential name is at most 64 characters long.'
    );
  });
});

describe('the row wording', () => {
  it('says when a credential was used, or that it never was', () => {
    expect(lastUsedText(null)).toBe('Never used');
    expect(lastUsedText(undefined)).toBe('Never used');
    expect(lastUsedText(Date.UTC(2026, 4, 6))).toBe(
      `Last used ${new Date(Date.UTC(2026, 4, 6)).toLocaleDateString()}`
    );
  });

  it('says when a credential was created', () => {
    expect(createdText(Date.UTC(2026, 4, 6))).toBe(
      `Created ${new Date(Date.UTC(2026, 4, 6)).toLocaleDateString()}`
    );
  });
});

describe('the dialog titles', () => {
  it('names each kind', () => {
    expect(credentialLabels('apiKey')).toEqual({
      create: 'Create API Key',
      created: 'API Key Created'
    });
    expect(credentialLabels('appPassword')).toEqual({
      create: 'Create App Password',
      created: 'App Password Created'
    });
  });
});
