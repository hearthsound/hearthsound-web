/**
 * Tests for the dialog's focus behavior: it opens on the first field, closes on
 * Escape, and gives focus back to the command that opened it.
 */
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import Dialog from './Dialog.svelte';

// jsdom lays nothing out, so every element reports no client rects; the dialog
// treats a field with no rects as hidden and would focus its first command.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'getClientRects', {
    configurable: true,
    value: () => [{ width: 10, height: 10 }]
  });
});

/** The dialog's body, with one field. */
const children = createRawSnippet(() => ({
  render: () => '<div><input aria-label="Name" /><button>Clear</button></div>'
}));

/** The dialog's action row. */
const footer = createRawSnippet(() => ({
  render: () => '<div><button>Cancel</button><button>Save</button></div>'
}));

afterEach(() => {
  cleanup();
});

describe('dialog focus', () => {
  it('opens with focus on the first field', () => {
    render(Dialog, { title: 'Add folder', onclose: () => {}, children, footer });

    expect(document.activeElement).toBe(document.querySelector('input[aria-label="Name"]'));
  });

  it('closes on Escape', async () => {
    const onclose = vi.fn();
    render(Dialog, { title: 'Add folder', onclose, children, footer });

    await fireEvent.keyDown(window, { key: 'Escape' });

    expect(onclose).toHaveBeenCalledTimes(1);
  });

  it('returns focus to the opener when it unmounts', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Open';
    document.body.append(opener);
    opener.focus();

    const { unmount } = render(Dialog, {
      title: 'Add folder',
      onclose: () => {},
      children,
      footer
    });
    expect(document.activeElement).not.toBe(opener);

    unmount();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
