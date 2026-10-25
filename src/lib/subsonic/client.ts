/**
 * The hand-written client for the server's Subsonic `/rest` surface.
 *
 * Read endpoints travel as GET requests with query parameters and mutating
 * endpoints as form-encoded POST bodies, which is what the server's `formPost`
 * extension accepts. Every call declares the protocol version, the client name
 * and the `hearthsound=1` vendor flag, so the responses carry the vendor member
 * this client renders. Binary endpoints (`stream`, `getCoverArt`) are plain
 * same-origin URLs the browser fetches itself, authenticated by the session
 * cookie; they carry no CSRF header because a media element cannot set one.
 *
 * A failed envelope becomes a {@link SubsonicError} so callers can branch on
 * the Subsonic error code.
 */
import { connection } from '#lib/stores/connection.svelte';

import type { Answer, FailureReason, SubsonicErrorBody } from './types';

/** The client name every call declares, which the server logs and audits. */
export const CLIENT_NAME = 'hearthsound-web';

/** The protocol version every call declares. */
export const PROTOCOL_VERSION = '1.16.1';

/** Header that carries the session's CSRF token. */
export const CSRF_HEADER = 'x-hearthsound-csrf';

/** A value a call may carry: a scalar, or a list to repeat one parameter with. */
export type ParamValue =
  string | number | boolean | null | undefined | readonly (string | number)[];

/** The parameters of a call, keyed by their Subsonic name. */
export type Params = Record<string, ParamValue>;

/** The parameters every call carries. */
const PROTOCOL_PARAMS: Readonly<Record<string, string>> = {
  f: 'json',
  v: PROTOCOL_VERSION,
  c: CLIENT_NAME
};

/** The parameter that opts into the vendor extension. */
const VENDOR_PARAMS: Readonly<Record<string, string>> = { hearthsound: '1' };

/** The failure of a call, carrying the Subsonic error code. */
export class SubsonicError extends Error {
  /** The Subsonic error code the server answered with. */
  readonly code: number;

  /** The documentation link the server attached, when it sent one. */
  readonly helpUrl: string | null;

  /**
   * The reason the server stored for the refusal, when it sent one.
   *
   * The base protocol has no field for it: a Hearthsound server adds
   * `hearthsoundReason` to the error of a refused acquisition, and the wording
   * of the refusal follows it instead of the bare code (A-web-player-6).
   */
  readonly reason: FailureReason | null;

  /**
   * Builds the error from the envelope's `error` member.
   *
   * @param error The `error` member of a failed envelope.
   */
  constructor(error: SubsonicErrorBody) {
    super(error.message ?? `Subsonic error ${error.code}`);
    this.name = 'SubsonicError';
    this.code = error.code;
    this.helpUrl = error.helpUrl ?? null;
    this.reason = KNOWN_REASONS.find((reason) => reason === error.hearthsoundReason) ?? null;
  }
}

/** The reasons a server may name, so an unknown token is no reason at all. */
const KNOWN_REASONS: readonly FailureReason[] = [
  'no-candidates',
  'no-acceptable-quality',
  'all-candidates-failed',
  'verification-failed',
  'backend-unavailable',
  'quota-exceeded',
  'permission-denied',
  'timeout',
  'cancelled'
];

/**
 * Callbacks the Subsonic client needs from the session store.
 *
 * A module that owns the session registers its implementation with
 * {@link setSubsonicHooks}; until it does, calls carry no CSRF token and a
 * cookie-authenticated request is refused by the server.
 */
export interface SubsonicHooks {
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
  expired?(): void;
}

/** The registered session hooks, or `null` while the session store is absent. */
let sessionHooks: SubsonicHooks | null = null;

/**
 * Registers the session store the Subsonic client should use.
 *
 * @param hooks Callbacks backed by the session store, or `null` to detach it.
 * @returns Nothing.
 */
export function setSubsonicHooks(hooks: SubsonicHooks | null): void {
  sessionHooks = hooks;
}

/** Options of a {@link SubsonicClient}. */
export interface SubsonicClientOptions {
  /** The origin the surface is mounted on; empty means this origin. */
  baseUrl?: string;
  /** The `fetch` implementation to use; defaults to the global one. */
  fetch?: typeof fetch;
}

/**
 * Renders parameters into a query string, repeating the ones that carry a list.
 *
 * @param params The call's parameters.
 * @param vendor Whether to include the `hearthsound=1` vendor flag.
 * @returns The encoded query string.
 */
function encode(params: Params, vendor: boolean): string {
  const query = new URLSearchParams({ ...PROTOCOL_PARAMS, ...(vendor ? VENDOR_PARAMS : {}) });
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        for (const item of value) {
          query.append(key, String(item));
        }
      } else {
        query.append(key, String(value));
      }
    }
  }
  return query.toString();
}

/**
 * The client every feature uses to call the Subsonic surface.
 *
 * It is a class so tests can bind it to a stub transport; the application uses
 * the {@link subsonic} instance.
 */
export class SubsonicClient {
  readonly #baseUrl: string;
  readonly #fetch: typeof fetch;

  /**
   * Builds a client.
   *
   * @param options The origin and transport to use.
   */
  constructor(options: SubsonicClientOptions = {}) {
    this.#baseUrl = options.baseUrl ?? '';
    this.#fetch =
      options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init));
  }

  /**
   * Calls a read endpoint and returns its payload.
   *
   * @param endpoint The endpoint name, for example `search3`.
   * @param params The call's parameters.
   * @returns The answer's payload, with its envelope members.
   * @throws SubsonicError when the server answers a failed envelope.
   */
  async get<T>(endpoint: string, params: Params = {}): Promise<Answer<T>> {
    const response = await this.#send(`${this.#url(endpoint)}?${encode(params, true)}`, {
      method: 'GET',
      headers: this.#headers()
    });
    return this.#unwrap<T>(response);
  }

  /**
   * Calls a mutating endpoint with a form-encoded body and returns its payload.
   *
   * @param endpoint The endpoint name, for example `hsSetQueue`.
   * @param params The call's parameters.
   * @returns The answer's payload, with its envelope members.
   * @throws SubsonicError when the server answers a failed envelope.
   */
  async post<T>(endpoint: string, params: Params = {}): Promise<Answer<T>> {
    const response = await this.#send(this.#url(endpoint), {
      method: 'POST',
      headers: { ...this.#headers(), 'content-type': 'application/x-www-form-urlencoded' },
      body: encode(params, true)
    });
    return this.#unwrap<T>(response);
  }

  /**
   * Builds the same-origin URL of a binary endpoint.
   *
   * The URL is handed to an `img` or `audio` element, which authenticates it
   * with the session cookie and cannot attach a header.
   *
   * @param endpoint The endpoint name, for example `stream`.
   * @param params The query parameters of the URL.
   * @returns A path under `/rest`, relative to the origin.
   */
  binaryUrl(endpoint: string, params: Params = {}): string {
    return `${this.#url(endpoint)}?${encode(params, false)}`;
  }

  /**
   * Builds the path of an endpoint.
   *
   * @param endpoint The endpoint name.
   * @returns The path, under `/rest`.
   */
  #url(endpoint: string): string {
    return `${this.#baseUrl}/rest/${endpoint}`;
  }

  /**
   * Sends one request and reports it to the connection store.
   *
   * A rejected request means the server did not answer; any response, even an
   * error, means it did. A 401 tells the session store the session ended, so
   * the sign-in page can explain why it is showing.
   *
   * @param url The request URL.
   * @param init The request options.
   * @returns The server's response.
   * @throws The transport's error when the request never reached the server.
   */
  async #send(url: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
      response = await this.#fetch(url, init);
    } catch (error) {
      connection.failed();
      throw error;
    }
    connection.answered();
    if (response.status === 401) {
      sessionHooks?.expired?.();
    }
    return response;
  }

  /**
   * Builds the request headers, with the session's CSRF token when there is one.
   *
   * @returns A fresh header set.
   */
  #headers(): Record<string, string> {
    const token = sessionHooks?.csrfToken() ?? null;
    return token === null ? {} : { [CSRF_HEADER]: token };
  }

  /**
   * Reads an envelope answer, throwing the server's failure as an error.
   *
   * @param response The server's response.
   * @returns The envelope, narrowed to the requested payload.
   * @throws SubsonicError when the envelope reports a failure.
   * @throws Error when the body is not a Subsonic envelope.
   */
  async #unwrap<T>(response: Response): Promise<Answer<T>> {
    const body = (await response.json()) as { 'subsonic-response'?: Answer<T> };
    const answer = body['subsonic-response'];
    if (answer === undefined) {
      throw new Error(`The server answered HTTP ${response.status} without a Subsonic envelope.`);
    }
    if (answer.status === 'failed') {
      throw new SubsonicError(answer.error ?? { code: 0 });
    }
    return answer;
  }
}

/** The client every feature uses to call the Subsonic surface. */
export const subsonic = new SubsonicClient();

/**
 * Reports whether a failed call means the entity does not exist.
 *
 * A drill-down page shows its not-found state for error 70 and its load-failure
 * state for everything else (p15, p16-r1, p17).
 *
 * @param error The error a read threw.
 * @returns `true` for the protocol's not-found error.
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof SubsonicError && error.code === 70;
}
