/**
 * Tests for the byte counts the admin views show.
 */
import { describe, expect, it } from 'vitest';

import { formatBytes } from './bytes';

describe('byte counts', () => {
  it('shows a count in the largest unit that keeps the number small', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.0 KiB');
    expect(formatBytes(1024 * 1024 * 3)).toBe('3.0 MiB');
    expect(formatBytes(1024 ** 4)).toBe('1.0 TiB');
  });

  it('shows a count that is not one as nothing', () => {
    expect(formatBytes(Number.NaN)).toBe('-');
    expect(formatBytes(-1)).toBe('-');
  });
});
