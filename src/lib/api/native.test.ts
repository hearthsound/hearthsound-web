/**
 * Tests for the native API client's session middleware: the CSRF header on
 * unsafe requests and the sign-out reaction to a rejected session.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionHooks } from './native';

/** Stand-in for the network that records the requests it receives. */
const fetchMock = vi.fn();

/**
 * `Request` that resolves the client's relative paths against an origin, the
 * way a browser does; Node's `Request` needs an absolute URL.
 */
class OriginRequest extends Request {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    super(typeof input === 'string' ? new URL(input, 'http://localhost').href : input, init);
  }
}

/**
 * Loads a fresh copy of the client bound to the given hooks, so each test
 * starts from a clean module state and a stubbed `fetch`.
 *
 * @param hooks Session hooks the client should use.
 * @returns The imported client module.
 */
async function loadClient(hooks: SessionHooks) {
  // openapi-fetch captures `globalThis.fetch` and `globalThis.Request` when the
  // client is created, so the stubs must be installed before a fresh copy of
  // the module runs.
  vi.resetModules();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubGlobal('Request', OriginRequest);
  const native = await import('./native');
  native.setSessionHooks(hooks);
  return native;
}

/**
 * Answers every request with the given status and JSON body.
 *
 * @param status HTTP status of the answer.
 * @param body JSON body of the answer.
 * @returns Nothing.
 */
function respondWith(status: number, body: unknown): void {
  fetchMock.mockImplementation(
    () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
      })
  );
}

describe('native API client', () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds the CSRF header only on unsafe requests', async () => {
    respondWith(200, { required: false });
    const { nativeClient } = await loadClient({
      csrfToken: () => 'csrf-token',
      signOut: vi.fn()
    });

    await nativeClient.GET('/api/v1/setup');
    await nativeClient.POST('/api/v1/auth/login', {
      body: { username: 'admin', password: 'secret' }
    });

    const requests = fetchMock.mock.calls.map(([request]) => request as Request);
    expect(requests[0].method).toBe('GET');
    expect(requests[0].headers.has('x-hearthsound-csrf')).toBe(false);
    expect(requests[1].method).toBe('POST');
    expect(requests[1].headers.get('x-hearthsound-csrf')).toBe('csrf-token');
  });

  it('signs out when a request outside auth and setup is rejected', async () => {
    respondWith(401, { error: { code: 'unauthenticated', message: 'No session.' } });
    const signOut = vi.fn();
    const { nativeClient } = await loadClient({ csrfToken: () => null, signOut });

    await nativeClient.GET('/api/v1/uploads');

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('leaves a rejected sign-in and setup to their callers', async () => {
    respondWith(401, { error: { code: 'unauthenticated', message: 'No session.' } });
    const signOut = vi.fn();
    const { nativeClient } = await loadClient({ csrfToken: () => null, signOut });

    await nativeClient.GET('/api/v1/auth/session');
    await nativeClient.POST('/api/v1/setup', {
      body: { token: 'setup-token', username: 'admin', password: 'secret' }
    });

    expect(signOut).not.toHaveBeenCalled();
  });
});
