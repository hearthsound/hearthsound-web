/**
 * Tests for the menu's keyboard model: the item order and wrap, Home and End,
 * Escape and focus return, feature content that opts into the item contract,
 * and the cascading submenu's Right and Left.
 */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import MenuFixture from './Menu.fixture.svelte';

/** A DOMRect of the given size at the given top-left corner. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({})
  };
}

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    })
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('menu keyboard', () => {
  it('moves, wraps, jumps and returns focus on Escape', async () => {
    const { getByLabelText } = render(MenuFixture, { variant: 'plain' });
    const trigger = getByLabelText('Actions');

    await fireEvent.click(trigger);
    await waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('One'));

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent?.trim()).toBe('Two');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent?.trim()).toBe('Three');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent?.trim()).toBe('One');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowUp' });
    expect(document.activeElement?.textContent?.trim()).toBe('Three');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Home' });
    expect(document.activeElement?.textContent?.trim()).toBe('One');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'End' });
    expect(document.activeElement?.textContent?.trim()).toBe('Three');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'Escape' });
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it('counts feature content that opts in with data-menu-item', async () => {
    const { getByLabelText } = render(MenuFixture, { variant: 'feature' });

    await fireEvent.click(getByLabelText('Actions'));
    await waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('Queue'));

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Like');

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowDown' });
    expect(document.activeElement?.textContent?.trim()).toBe('Album');
  });

  it('opens a submenu with Right and returns with Left', async () => {
    const { getByLabelText } = render(MenuFixture, { variant: 'submenu' });

    await fireEvent.click(getByLabelText('Actions'));
    await waitFor(() =>
      expect(document.activeElement?.textContent?.trim()).toContain('Appearance')
    );

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
    await waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('Dark'));

    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowLeft' });
    await waitFor(() =>
      expect(document.activeElement?.textContent?.trim()).toContain('Appearance')
    );
  });

  it('flips an open submenu to the left when its right edge would leave the viewport', async () => {
    const { getByLabelText } = render(MenuFixture, { variant: 'submenu' });

    await fireEvent.click(getByLabelText('Actions'));
    await fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowRight' });
    await waitFor(() => expect(document.activeElement?.textContent?.trim()).toBe('Dark'));

    const submenu = document.querySelector('.hs-submenu') as HTMLElement;
    const item = submenu.parentElement as HTMLElement;
    vi.spyOn(item, 'getBoundingClientRect').mockReturnValue(rect(700, 100, 270, 40));
    vi.spyOn(submenu, 'getBoundingClientRect').mockReturnValue(rect(976, 100, 270, 200));

    window.dispatchEvent(new Event('resize'));

    await waitFor(() => expect(submenu.style.right).toBe('calc(100% + 6px)'));
    expect(submenu.style.left).toBe('auto');
  });
});
