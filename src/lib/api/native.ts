/**
 * Typed client for the server's native API.
 *
 * Every path under `/api/v1` is defined by the OpenAPI document committed in
 * `api/openapi.json` and mirrored by the generated types in `./schema`. The
 * client sends same-origin requests from the origin root, attaches the
 * session's CSRF token to unsafe requests, and reports a rejected session
 * through the hooks the session store registers, which clears the session and
 * sends the browser to the sign-in page. Every answer and every failed request
 * is also reported to the connection store, which drives the p27 unreachable
 * banner.
 */
import createClient from 'openapi-fetch';
import type { Middleware } from 'openapi-fetch';

import { connection } from '#lib/stores/connection.svelte';

import type { paths } from './schema';

/** Header that carries the session's CSRF token on unsafe requests. */
export const CSRF_HEADER = 'x-hearthsound-csrf';

/**
 * Callbacks the native API client needs from the session store.
 *
 * A module that owns the session registers its implementation with
 * {@link setSessionHooks}; until it does, unsafe requests carry no CSRF token
 * and a rejected session is only surfaced to the caller.
 */
export interface SessionHooks {
  /**
   * Returns the CSRF token of the signed-in session.
   *
   * @returns The token, or `null` when no session is signed in.
   */
  csrfToken(): string | null;
  /**
   * Clears the session the server rejected and opens the sign-in page with the
   * p27 expired banner.
   *
   * @returns Nothing.
   */
  expired(): void;
}

/** The registered session hooks, or `null` while the session store is absent. */
let sessionHooks: SessionHooks | null = null;

/**
 * Registers the session store the API client should use.
 *
 * @param hooks Callbacks backed by the session store, or `null` to detach it.
 * @returns Nothing.
 */
export function setSessionHooks(hooks: SessionHooks | null): void {
  sessionHooks = hooks;
}

/** Middleware that ties every request to the signed-in session. */
const sessionMiddleware: Middleware = {
  onRequest({ request }) {
    if (request.method === 'GET' || request.method === 'HEAD') {
      return;
    }
    const token = sessionHooks?.csrfToken() ?? null;
    if (token !== null) {
      request.headers.set(CSRF_HEADER, token);
    }
  },
  onResponse({ response, schemaPath }) {
    connection.answered();
    const answersOwnUnauthorized =
      schemaPath.startsWith('/api/v1/auth/') || schemaPath === '/api/v1/setup';
    if (response.status === 401 && sessionHooks !== null && !answersOwnUnauthorized) {
      sessionHooks.expired();
    }
  },
  onError() {
    connection.failed();
  }
};

/**
 * The client every feature uses to call the native API.
 *
 * Paths are relative to the origin root; the server serves both the client
 * and the API from the same origin.
 */
export const nativeClient = createClient<paths>({
  baseUrl: ''
});

nativeClient.use(sessionMiddleware);
