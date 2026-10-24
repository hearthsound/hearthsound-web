/**
 * Tests for a cover image: a picture this session already loaded is drawn
 * without asking the gate, and a cover that failed keeps the placeholder.
 */
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A gate whose loaded URLs the test sets, and whose loads it answers by hand.
 * The set holds id fragments, because the component asks about the whole URL the
 * server is given.
 */
const gate = vi.hoisted(() => {
  const loaded = new Set<string>();
  let answer: () => boolean = () => false;
  return {
    loaded,
    /** Sets what the next load answers. */
    answers(ok: boolean) {
      answer = () => ok;
    },
    load: vi.fn((url: string) => {
      const ok = answer();
      if (ok) {
        loaded.add(url);
      }
      return { done: Promise.resolve(ok), cancel() {} };
    }),
    isLoaded: vi.fn((url: string) => [...loaded].some((part) => url.includes(part)))
  };
});

vi.mock('#lib/ui/image-loader', () => ({ imageLoader: gate }));

import CoverArt from './CoverArt.svelte';

afterEach(() => {
  cleanup();
  gate.loaded.clear();
  gate.answers(false);
  vi.clearAllMocks();
});

describe('a cover image', () => {
  it('draws a picture this session already loaded without asking the gate', async () => {
    gate.loaded.add('id=al_1');

    const { container } = render(CoverArt, {
      props: { coverArt: 'al_1', size: 96, alt: 'Test Album' }
    });

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    const image = container.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toContain('id=al_1');
    expect(image.getAttribute('src')).toContain('size=96');
    expect(image.getAttribute('alt')).toBe('Test Album');
    expect(gate.load).not.toHaveBeenCalled();
  });

  it('draws the picture the gate answered with', async () => {
    gate.answers(true);

    const { container } = render(CoverArt, { props: { coverArt: 'al_2' } });

    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(gate.load).toHaveBeenCalledTimes(1);
  });

  it('keeps the placeholder for a picture the browser could not paint', async () => {
    gate.loaded.add('id=al_5');

    const { container } = render(CoverArt, { props: { coverArt: 'al_5' } });
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());

    const image = container.querySelector('img') as HTMLImageElement;
    image.dispatchEvent(new Event('error'));

    await waitFor(() => expect(container.querySelector('img')).toBeNull());
    expect(container.querySelector('.hs-art-placeholder')).not.toBeNull();
  });
});
