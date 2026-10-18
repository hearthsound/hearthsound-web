/**
 * Tests for the playlist rules: what the lifetime control does and says, and
 * what a playlist's lifetime shows.
 */
import { describe, expect, it } from 'vitest';

import { lifetimeAction, lifetimeBadge } from './playlists';

describe('playlist lifetime control', () => {
  it('offers to make a permanent playlist temporary', () => {
    expect(lifetimeAction({ temporary: false })).toEqual({
      temporary: true,
      label: 'Make temporary'
    });
  });

  it('offers to make a temporary playlist permanent', () => {
    expect(lifetimeAction({ temporary: true })).toEqual({
      temporary: false,
      label: 'Keep permanently'
    });
  });
});

describe('playlist lifetime badge', () => {
  it('says nothing about a permanent playlist', () => {
    expect(lifetimeBadge({ temporary: false })).toBeNull();
    expect(lifetimeBadge(undefined)).toBeNull();
    expect(lifetimeBadge(null)).toBeNull();
  });

  it('marks a temporary playlist that does not expire', () => {
    expect(lifetimeBadge({ temporary: true })).toBe('Temporary');
  });

  it('names the instant a temporary playlist expires at', () => {
    const badge = lifetimeBadge({ temporary: true, expiresAt: Date.UTC(2026, 0, 2, 3, 4, 5) });

    expect(badge?.startsWith('Temporary until ')).toBe(true);
  });
});
