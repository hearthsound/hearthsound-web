/**
 * Tests for the toast stack: identity, dismissal and notices.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { noticeEvent } from '#lib/testing/event-stream';
import { ToastStore } from './toasts.svelte';

describe('toast stack', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('adds messages with an identity each and keeps them in order', () => {
    const stack = new ToastStore();

    const first = stack.push('Uploading a file');
    const second = stack.push('Could not get this song', 'error');

    expect(first).not.toBe(second);
    expect(stack.items.map((toast) => toast.message)).toEqual([
      'Uploading a file',
      'Could not get this song'
    ]);
    expect(stack.items[1].level).toBe('error');
  });

  it('keeps a message until it is dismissed, without a lifetime of its own', () => {
    const stack = new ToastStore();

    const kept = stack.push('Still here');
    const dropped = stack.push('Gone soon');
    stack.dismiss(dropped);
    expect(stack.items.map((toast) => toast.id)).toEqual([kept]);

    // The view owns the five-second lifetime (k20-r3): the store itself never
    // drops a message, because only the view knows whether it is paused.
    vi.advanceTimersByTime(10 * 60 * 1000);
    expect(stack.items.map((toast) => toast.id)).toEqual([kept]);
  });

  it('shows a notice with the severity it carries', () => {
    const stack = new ToastStore();

    stack.apply(noticeEvent('The server is restarting', undefined, 'info'));
    stack.apply(noticeEvent('Events were lost', 'events-lost', 'warn'));
    stack.apply(noticeEvent('Storage is full', undefined, 'error'));

    expect(stack.items.map((toast) => toast.level)).toEqual(['info', 'warn', 'error']);
  });
});
