/**
 * The signed-in session: the account, the CSRF token and the server's shape.
 *
 * The client boots by asking the server whether it still needs its first
 * administrator and, when it does not, whether the browser holds a session;
 * {@link SessionStore.boot} answers with the route the shell should show. A
 * session rejected by any later call is cleared through the native client's
 * sign-out hook, which sends the browser to the sign-in page; the route the
 * user was on is remembered and visited again after signing in.
 */
import { nativeClient, setSessionHooks } from '#lib/api/native';
import type { components } from '#lib/api/schema';
import { navigate } from '#lib/navigation';
import { player } from '#lib/player/player.svelte';
import { events } from '#lib/stores/events.svelte';
import { setSubsonicHooks } from '#lib/subsonic/client';

/** The account, as the native API reports it. */
export type UserView = components['schemas']['UserView'];

/** What this server is and what it offers. */
export type SystemInfo = components['schemas']['SystemInfo'];

/** The account and CSRF token a session answer carries. */
export interface AdoptedSession {
  /** The signed-in account. */
  user: UserView;
  /** The session's CSRF token. */
  csrfToken?: string | null;
}

/** The outcome of a sign-in attempt. */
export type SignInOutcome =
  { ok: true; session: AdoptedSession } | { ok: false; code: string | null };

/** The native API calls the session makes. */
export interface SessionApi {
  /**
   * Reports whether the server still needs its first administrator.
   *
   * @returns The status, or `null` when the server did not answer.
   */
  setupStatus(): Promise<{ required: boolean } | null>;
  /**
   * Reports who the browser is.
   *
   * @returns The session, or `null` when the browser has none.
   */
  session(): Promise<AdoptedSession | null>;
  /**
   * Signs in with an account password.
   *
   * @param username The account's sign-in name.
   * @param password The account's password.
   * @returns The started session, or the problem code the server answered.
   */
  login(username: string, password: string): Promise<SignInOutcome>;
  /**
   * Ends the browser's session.
   *
   * @returns Nothing.
   */
  logout(): Promise<void>;
  /**
   * Reads what the server offers.
   *
   * @returns The server's shape, or `null` when the call failed.
   */
  systemInfo(): Promise<SystemInfo | null>;
}

/** The session calls, made against the native API. */
export const nativeSessionApi: SessionApi = {
  async setupStatus() {
    const answer = await nativeClient.GET('/api/v1/setup');
    return answer.data ?? null;
  },
  async session() {
    const answer = await nativeClient.GET('/api/v1/auth/session');
    return answer.data ?? null;
  },
  async login(username, password) {
    const answer = await nativeClient.POST('/api/v1/auth/login', {
      body: { username, password }
    });
    return answer.data === undefined
      ? { ok: false, code: answer.error?.code ?? null }
      : { ok: true, session: answer.data };
  },
  async logout() {
    await nativeClient.POST('/api/v1/auth/logout');
  },
  async systemInfo() {
    const answer = await nativeClient.GET('/api/v1/system/info');
    return answer.data ?? null;
  }
};

/** Where the user goes next, given what the server answered while booting. */
export interface BootState {
  /** Whether the server still needs its first administrator. */
  setupRequired: boolean;
  /** Whether the browser holds a session. */
  signedIn: boolean;
}

/**
 * Returns the route the shell should show after booting.
 *
 * @param state What the server answered while booting.
 * @returns The route to visit, or `null` to stay where the browser is.
 */
export function bootTarget(state: BootState): string | null {
  if (state.setupRequired) {
    return '/setup';
  }
  return state.signedIn ? null : '/login';
}

/**
 * Returns the message to show for a failed sign-in.
 *
 * @param code The problem code the server answered, when it gave one.
 * @returns The message.
 */
export function signInFailure(code: string | null): string {
  if (code === 'rate-limited') {
    return 'Too many failed sign-ins. Try again in a minute.';
  }
  if (code === 'unauthenticated') {
    return 'Wrong username or password.';
  }
  return 'Could not sign in. Try again.';
}

/** The client's session. */
export class SessionStore {
  /** The signed-in account, or `null`. */
  user = $state<UserView | null>(null);

  /** The CSRF token unsafe requests must carry. */
  csrfToken = $state<string | null>(null);

  /** What the server is and what it offers, once a session read it. */
  systemInfo = $state<SystemInfo | null>(null);

  /** The route to visit after signing in, when the user was sent to sign in. */
  returnTo = $state<string | null>(null);

  /** Whether the boot sequence finished. */
  ready = $state(false);

  /** Whether the server ended a session the client still believed in (p27). */
  expired = $state(false);

  readonly #api: SessionApi;

  /** The boot sequence, so every caller awaits the same run. */
  #booting: Promise<string | null> | null = null;

  /**
   * Builds a store.
   *
   * @param api The session calls to make.
   */
  constructor(api: SessionApi = nativeSessionApi) {
    this.#api = api;
  }

  /** Whether the signed-in account administers the server. */
  get isAdmin(): boolean {
    return this.user?.isAdmin === true;
  }

  /**
   * Runs the boot sequence and reports where the shell should go.
   *
   * A server that still needs its first administrator sends the browser to the
   * setup wizard, a browser without a session to the sign-in form, and a
   * signed-in browser stays on the route it opened.
   *
   * The shell and the administration guard both ask for the answer; the
   * sequence itself runs once, so opening an administration route by hand does
   * not ask the server twice.
   *
   * @returns The route to visit, or `null` to stay.
   */
  boot(): Promise<string | null> {
    this.#booting ??= this.#runBoot();
    return this.#booting;
  }

  /**
   * Runs the boot sequence, once per store.
   *
   * @returns The route to visit, or `null` to stay.
   */
  async #runBoot(): Promise<string | null> {
    let setupRequired: boolean;
    let answer: AdoptedSession | null;
    try {
      setupRequired = (await this.#api.setupStatus())?.required === true;
      answer = setupRequired ? null : await this.#api.session();
    } catch {
      // The server did not answer. The API layer already reported it, so the
      // shell stays on the route it opened and lets the unreachable banner
      // explain, instead of sending the browser to sign in.
      this.ready = true;
      return null;
    }
    if (answer !== null) {
      this.adopt(answer);
      await this.loadSystemInfo();
      events.open();
    }
    this.ready = true;
    return bootTarget({ setupRequired, signedIn: this.user !== null });
  }

  /**
   * Signs in and adopts the started session.
   *
   * @param username The account's sign-in name.
   * @param password The account's password.
   * @returns `null` on success, or the message to show.
   */
  async signIn(username: string, password: string): Promise<string | null> {
    const outcome = await this.#api.login(username, password);
    if (!outcome.ok) {
      return signInFailure(outcome.code);
    }
    this.adopt(outcome.session);
    this.expired = false;
    await this.loadSystemInfo();
    events.open();
    return null;
  }

  /**
   * Ends the session on the server and clears it here.
   *
   * A server that cannot end the session, because it is unreachable or already
   * forgot it, does not keep the browser signed in.
   *
   * @returns Nothing.
   */
  async signOut(): Promise<void> {
    try {
      await this.#api.logout();
    } catch {
      // The session is cleared locally either way.
    }
    this.clear();
  }

  /**
   * Adopts the account and CSRF token of a session answer.
   *
   * The account's stored playback comes back with it, paused, so a refresh
   * shows what that account was playing.
   *
   * @param session The session the server reported.
   * @returns Nothing.
   */
  adopt(session: AdoptedSession): void {
    this.user = session.user;
    this.csrfToken = session.csrfToken ?? null;
    player.restorePlayback(session.user.id);
  }

  /**
   * Forgets the session and closes the event stream.
   *
   * Every listener's stored queue on this browser goes, so signing out leaves
   * nothing of anyone behind; an account's own queue comes back from the server
   * when it signs in again (E-G-2, E-L-1).
   *
   * @returns Nothing.
   */
  clear(): void {
    this.user = null;
    this.csrfToken = null;
    this.systemInfo = null;
    this.expired = false;
    player.forgetAllPlayback();
    events.close();
  }

  /**
   * Records that the server ended a session the client believed in.
   *
   * The sign-in page explains the reason above its title. Signing in again
   * clears it (p27).
   *
   * @returns Nothing.
   */
  expire(): void {
    this.clear();
    this.expired = true;
  }

  /**
   * Reads what the server offers into the store.
   *
   * @returns Nothing.
   */
  async loadSystemInfo(): Promise<void> {
    this.systemInfo = await this.#api.systemInfo();
  }

  /**
   * Remembers a route to visit after signing in.
   *
   * The sign-in and setup routes are not remembered: they are where the user is
   * sent, not where they wanted to go.
   *
   * @param route The route the user opened.
   * @returns Nothing.
   */
  rememberReturnTo(route: string): void {
    if (route === '/login' || route.startsWith('/setup')) {
      return;
    }
    this.returnTo = route;
  }

  /**
   * Returns the remembered route and forgets it.
   *
   * @returns The route, or `null` when the user came to the sign-in page by
   *   itself.
   */
  takeReturnTo(): string | null {
    const route = this.returnTo;
    this.returnTo = null;
    return route;
  }
}

/** The client's session. */
export const session = new SessionStore();

/**
 * Reports that the server rejected the session the client believed in.
 *
 * Both API layers call this on a 401; a browser that is not signed in has
 * nothing to explain, so a rejected sign-in or boot read leaves it alone.
 *
 * @returns Nothing.
 */
function expireSession(): void {
  if (session.user === null) {
    return;
  }
  session.expire();
  void navigate('/login');
}

setSessionHooks({
  csrfToken: () => session.csrfToken,
  expired: expireSession
});

setSubsonicHooks({
  csrfToken: () => session.csrfToken,
  expired: expireSession
});
