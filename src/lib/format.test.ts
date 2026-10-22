/**
 * Tests for the fixed text and formatting the views share.
 */
import { describe, expect, it } from 'vitest';

import { formatBytes, formatDuration, formatMinuteTotal } from './format';

describe('durations', () => {
  it('reads a duration as minutes and two-digit seconds', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(187)).toBe('3:07');
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(3599)).toBe('59:59');
    expect(formatDuration(3600)).toBe('60:00');
  });

  it('drops a part of a second instead of rounding it up', () => {
    expect(formatDuration(59.9)).toBe('0:59');
  });

  it('reads an unknown or impossible duration as nothing', () => {
    expect(formatDuration(null)).toBe('-:--');
    expect(formatDuration(undefined)).toBe('-:--');
    expect(formatDuration(-1)).toBe('-:--');
    expect(formatDuration(Number.NaN)).toBe('-:--');
  });
});

describe('minute totals', () => {
  it('counts any part of a minute as a whole one', () => {
    expect(formatMinuteTotal(0)).toBe('1 min');
    expect(formatMinuteTotal(1)).toBe('1 min');
    expect(formatMinuteTotal(60)).toBe('1 min');
    expect(formatMinuteTotal(61)).toBe('2 min');
  });

  it('reads a long collection as its whole minutes', () => {
    expect(formatMinuteTotal(42 * 60)).toBe('42 min');
  });
});

describe('byte counts', () => {
  it('shows a count in the largest unit that keeps the number small', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
    expect(formatBytes(1024)).toBe('1.0 KiB');
    expect(formatBytes(1024 * 1024 * 3)).toBe('3.0 MiB');
    expect(formatBytes(1024 ** 4)).toBe('1.0 TiB');
  });

  it('shows a count that is not one as nothing', () => {
    expect(formatBytes(Number.NaN)).toBe('-');
    expect(formatBytes(-1)).toBe('-');
  });
});
