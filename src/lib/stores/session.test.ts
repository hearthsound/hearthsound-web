/**
 * Tests for the session store: the boot sequence, signing in and out, and the
 * route the user returns to.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { player } from '#lib/player/player.svelte';

import { events } from './events.svelte';
import { bootTarget, SessionStore, signInFailure } from './session.svelte';
import type { SessionApi, UserView } from './session.svelte';

/** The account every fixture reports. */
const account: UserView = {
  id: 'us_1',
  username: 'admin',
  displayName: 'Admin',
  isAdmin: true,
  createdAt: 0,
  updatedAt: 0,
  permissions: { acquire: true, upload: true, download: true }
};

/**
 * Builds a session API whose answers a test overrides.
 *
 * @param overrides The calls to replace.
 * @returns The API the store should use.
 */
function fakeApi(overrides: Partial<SessionApi> = {}): SessionApi {
  return {
    setupStatus: async () => ({ required: false }),
    session: async () => null,
    login: async () => ({ ok: false, code: null }),
    logout: async () => {},
    systemInfo: async () => null,
    ...overrides
  };
}

describe('boot target', () => {
  it('sends a server without an administrator to setup', () => {
    expect(bootTarget({ setupRequired: true, signedIn: false })).toBe('/setup');
    expect(bootTarget({ setupRequired: true, signedIn: true })).toBe('/setup');
  });

  it('sends a browser without a session to sign in', () => {
    expect(bootTarget({ setupRequired: false, signedIn: false })).toBe('/login');
  });

  it('leaves a signed-in browser where it is', () => {
    expect(bootTarget({ setupRequired: false, signedIn: true })).toBeNull();
  });
});

describe('sign-in failure messages', () => {
  it('names the reason the server gave', () => {
    expect(signInFailure('unauthenticated')).toBe('Wrong username or password.');
    expect(signInFailure('rate-limited')).toBe('Too many failed sign-ins. Try again in a minute.');
    expect(signInFailure('internal')).toBe('Could not sign in. Try again.');
    expect(signInFailure(null)).toBe('Could not sign in. Try again.');
  });
});

describe('session store', () => {
  beforeEach(() => {
    vi.spyOn(events, 'open').mockImplementation(() => {});
    vi.spyOn(events, 'close').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not ask for a session while the server has no administrator', async () => {
    const askSession = vi.fn(async () => null);
    const store = new SessionStore(
      fakeApi({ setupStatus: async () => ({ required: true }), session: askSession })
    );

    await expect(store.boot()).resolves.toBe('/setup');

    expect(askSession).not.toHaveBeenCalled();
    expect(store.ready).toBe(true);
    expect(store.user).toBeNull();
  });

  it('adopts the session the server reported', async () => {
    const store = new SessionStore(
      fakeApi({
        session: async () => ({ user: account, csrfToken: 'csrf-token' }),
        systemInfo: async () => ({
          apiVersion: 1,
          serverType: 'hearthsound',
          version: '0.1.4',
          features: {
            acquireOnSave: true,
            acquireOnPlaylistAdd: true,
            serverBrowse: true,
            uploads: true
          },
          layers: []
        })
      })
    );

    await expect(store.boot()).resolves.toBeNull();

    expect(store.user?.id).toBe('us_1');
    expect(store.csrfToken).toBe('csrf-token');
    expect(store.systemInfo?.version).toBe('0.1.4');
    expect(events.open).toHaveBeenCalledTimes(1);
  });

  it('leaves a browser without a session to sign in', async () => {
    const store = new SessionStore(fakeApi());

    await expect(store.boot()).resolves.toBe('/login');

    expect(store.user).toBeNull();
    expect(store.ready).toBe(true);
    expect(events.open).not.toHaveBeenCalled();
  });

  it('keeps the session the server started on sign-in', async () => {
    const store = new SessionStore(
      fakeApi({ login: async () => ({ ok: true, session: { user: account, csrfToken: 'c' } }) })
    );

    await expect(store.signIn('admin', 'secret')).resolves.toBeNull();

    expect(store.user?.displayName).toBe('Admin');
    expect(store.csrfToken).toBe('c');
    expect(events.open).toHaveBeenCalledTimes(1);
  });

  it('stays on the route when the server cannot be reached while booting', async () => {
    const store = new SessionStore(
      fakeApi({
        setupStatus: async () => {
          throw new Error('unreachable');
        }
      })
    );

    await expect(store.boot()).resolves.toBeNull();

    expect(store.ready).toBe(true);
    expect(store.user).toBeNull();
  });

  it('records an expired session and clears the reason on the next sign-in', async () => {
    const store = new SessionStore(
      fakeApi({
        session: async () => ({ user: account, csrfToken: 'csrf-token' }),
        login: async () => ({ ok: true, session: { user: account, csrfToken: 'new' } })
      })
    );
    await store.boot();

    store.expire();

    expect(store.expired).toBe(true);
    expect(store.user).toBeNull();
    expect(store.csrfToken).toBeNull();

    await store.signIn('admin', 'secret');
    expect(store.expired).toBe(false);
    expect(store.user?.id).toBe('us_1');
  });

  it('answers a rejected sign-in with the reason', async () => {
    const store = new SessionStore(
      fakeApi({ login: async () => ({ ok: false, code: 'unauthenticated' }) })
    );

    await expect(store.signIn('admin', 'wrong')).resolves.toBe('Wrong username or password.');
    expect(store.user).toBeNull();
  });

  it('clears the session even when the server cannot end it', async () => {
    const store = new SessionStore(
      fakeApi({
        session: async () => ({ user: account, csrfToken: 'csrf-token' }),
        logout: async () => {
          throw new Error('unreachable');
        }
      })
    );
    await store.boot();

    await store.signOut();

    expect(store.user).toBeNull();
    expect(store.csrfToken).toBeNull();
    expect(store.systemInfo).toBeNull();
    expect(events.close).toHaveBeenCalled();
  });

  it('clears every stored queue on the browser when the session ends', () => {
    const store = new SessionStore(fakeApi());
    const sweep = vi.spyOn(player, 'forgetAllPlayback');

    store.clear();

    expect(sweep).toHaveBeenCalledOnce();
  });

  it('remembers where to go after signing in, but not the sign-in route', () => {
    const store = new SessionStore(fakeApi());

    store.rememberReturnTo('/login');
    store.rememberReturnTo('/setup?token=abc');
    expect(store.takeReturnTo()).toBeNull();

    store.rememberReturnTo('/library/albums');
    expect(store.takeReturnTo()).toBe('/library/albums');
    expect(store.takeReturnTo()).toBeNull();
  });
});
