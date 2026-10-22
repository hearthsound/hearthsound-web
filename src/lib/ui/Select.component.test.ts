/**
 * Tests for the drop-down's keyboard: opening, moving, choosing with Enter,
 * reporting the choice, and Escape leaving the value alone.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import Select from './Select.svelte';

/** The choices the tests offer. */
const options = [
  { value: 'flac', label: 'FLAC' },
  { value: 'mp3', label: 'MP3' },
  { value: 'opus', label: 'Opus' }
];

afterEach(() => {
  cleanup();
});

describe('select keyboard', () => {
  it('chooses an option with the arrow keys and Enter', async () => {
    const onchange = vi.fn();
    render(Select, { label: 'Format', options, value: 'flac', onchange });
    const trigger = screen.getByRole('button', { name: 'Format FLAC' });

    await fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(document.activeElement?.textContent).toContain('FLAC');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent).toContain('MP3');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Enter' });

    expect(onchange).toHaveBeenCalledWith('mp3');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByRole('button', { name: 'Format MP3' })).toBe(trigger);
  });

  it('closes on Escape without choosing', async () => {
    const onchange = vi.fn();
    render(Select, { label: 'Format', options, value: 'flac', onchange });
    const trigger = screen.getByRole('button', { name: 'Format FLAC' });

    await fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });

    expect(onchange).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByRole('button', { name: 'Format FLAC' })).toBe(trigger);
  });
});
