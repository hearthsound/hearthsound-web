/**
 * Tests for where the search results return to: the page the search was opened
 * from, and the shared back helper when there is none.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { goBack, navigate } = vi.hoisted(() => ({
  goBack: vi.fn(),
  navigate: vi.fn(async () => {})
}));

vi.mock('./navigation', () => ({ goBack, navigate }));

import { forgetSearchOrigin, rememberSearchOrigin, returnFromSearch } from './search-navigation';

describe('search navigation', () => {
  beforeEach(() => {
    goBack.mockClear();
    navigate.mockClear();
    forgetSearchOrigin();
  });

  it('returns to the page the search was opened from', () => {
    rememberSearchOrigin('/artist/ar-1');

    returnFromSearch();

    expect(navigate).toHaveBeenCalledWith('/artist/ar-1', { replaceState: true });
    expect(goBack).not.toHaveBeenCalled();
  });

  it('forgets the recorded page after returning once', () => {
    rememberSearchOrigin('/artist/ar-1');
    returnFromSearch();
    navigate.mockClear();

    returnFromSearch();

    expect(goBack).toHaveBeenCalledWith('/library/albums');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('leaves a direct visit to the shared back helper', () => {
    returnFromSearch();

    expect(goBack).toHaveBeenCalledWith('/library/albums');
    expect(navigate).not.toHaveBeenCalled();
  });
});
