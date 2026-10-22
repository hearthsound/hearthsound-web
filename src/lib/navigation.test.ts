/**
 * Tests for client navigation: the route name `resolve` receives, and the
 * history-aware back helper.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { goto } = vi.hoisted(() => ({ goto: vi.fn(async () => {}) }));

vi.mock('$app/navigation', () => ({ goto }));
vi.mock('$app/paths', () => ({ resolve: (path: string) => `/${path}` }));

import { clientRoute, goBack, navigate } from './navigation';

describe('client route', () => {
  it('names a route without its leading slash', () => {
    expect(clientRoute('/library/albums')).toBe('library/albums');
    expect(clientRoute('library/albums')).toBe('library/albums');
  });
});

describe('navigate', () => {
  beforeEach(() => {
    goto.mockClear();
  });

  it('resolves the route and passes the options through', async () => {
    await navigate('/artist/ar-1', { replaceState: true });

    expect(goto).toHaveBeenCalledWith('/artist/ar-1', { replaceState: true });
  });
});

describe('go back', () => {
  beforeEach(() => {
    goto.mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the browser history when there is a page before this one', () => {
    const back = vi.fn();
    vi.stubGlobal('window', { history: { length: 2, back } });

    goBack('/library/albums');

    expect(back).toHaveBeenCalledTimes(1);
    expect(goto).not.toHaveBeenCalled();
  });

  it('opens the fallback when there is no page before this one', () => {
    vi.stubGlobal('window', { history: { length: 1, back: vi.fn() } });

    goBack('/library/albums');

    expect(goto).toHaveBeenCalledWith('/library/albums', undefined);
  });
});
