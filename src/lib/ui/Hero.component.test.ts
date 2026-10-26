/**
 * Tests for the hero's biography: the clamp stays, Show more is drawn only when
 * the text has more lines than the clamp shows, and it opens the whole text in
 * a dialog instead of growing the hero.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import Hero from './Hero.svelte';

// jsdom has no ResizeObserver, which the biography uses to measure its clamp.
vi.stubGlobal(
  'ResizeObserver',
  class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
);

/** Whether the stubbed paragraph reports more text than the clamp shows. */
let overflowing = true;

// jsdom lays nothing out, so every box measures zero and no text is ever
// clamped; the paragraph's own measure is stubbed instead.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get: () => (overflowing ? 400 : 40)
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    get: () => 40
  });
});

/** The first lines of a biography the hero clamps. */
const BIO = 'A trumpet player from North Carolina who reshaped the quartet. '.repeat(6);

afterEach(() => {
  overflowing = true;
  cleanup();
});

describe('the hero biography', () => {
  it('opens the whole text in a dialog instead of growing the hero', async () => {
    render(Hero, { title: 'Blue Train', bio: BIO });

    const more = await waitFor(() => screen.getByRole('button', { name: 'Show more' }));
    await fireEvent.click(more);

    const dialog = screen.getByRole('dialog', { name: 'About Blue Train' });
    expect(dialog.textContent).toContain('A trumpet player from North Carolina');
    // The hero keeps its clamped paragraph: nothing moved down the page.
    expect(document.querySelector('.hs-hero__bio p')?.textContent).toBe(BIO);
  });

  it('opens with focus on the text, not on the Close command at its end', async () => {
    // jsdom lays nothing out, and the dialog only focuses a field that is drawn.
    const rects = vi
      .spyOn(HTMLElement.prototype, 'getClientRects')
      .mockReturnValue([new DOMRect(0, 0, 10, 10)] as unknown as DOMRectList);
    render(Hero, { title: 'Blue Train', bio: BIO });
    await fireEvent.click(await waitFor(() => screen.getByRole('button', { name: 'Show more' })));

    // Focusing Close would scroll a long biography to its last line on a phone.
    const dialog = screen.getByRole('dialog', { name: 'About Blue Train' });
    await waitFor(() => expect(document.activeElement?.tagName).toBe('P'));
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.textContent).toBe(BIO);
    rects.mockRestore();
  });

  it('closes with its Close command and with Escape', async () => {
    render(Hero, { title: 'Blue Train', bio: BIO });
    await fireEvent.click(await waitFor(() => screen.getByRole('button', { name: 'Show more' })));

    await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(screen.getByRole('dialog')).not.toBeNull());

    await fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('draws no Show more for a biography that fits the clamp', async () => {
    overflowing = false;
    render(Hero, { title: 'Blue Train', bio: 'One line is enough.' });

    expect(screen.getByText('One line is enough.')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull());
  });

  it('draws no biography block at all when the artist has none', () => {
    render(Hero, { title: 'Blue Train' });

    expect(document.querySelector('.hs-hero__bio')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
});
