/**
 * Tests for a cover image: a picture this session already loaded is drawn
 * without asking the gate, and a cover that failed keeps the placeholder and is
 * not asked for again by the next box that shows it.
 */
import { cleanup, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * A gate whose loaded and failed URLs the test sets, and whose loads it
 * answers by hand. The sets hold id fragments, because the component asks about
 * the whole URL the server is given.
 */
const gate = vi.hoisted(() => {
  const loaded = new Set<string>();
  const failed = new Set<string>();
  const matches = (set: Set<string>, url: string) => [...set].some((part) => url.includes(part));
  let answer: () => boolean = () => false;
  return {
    loaded,
    failed,
    /** Sets what the next load answers. */
    answers(ok: boolean) {
      answer = () => ok;
    },
    load: vi.fn((url: string) => {
      const ok = answer();
      if (ok) {
        loaded.add(url);
      } else {
        failed.add(url);
      }
      return { done: Promise.resolve(ok), cancel() {} };
    }),
    isLoaded: vi.fn((url: string) => matches(loaded, url)),
    isFailed: vi.fn((url: string) => matches(failed, url)),
    reportFailure: vi.fn((url: string) => failed.add(url))
  };
});

vi.mock('#lib/ui/image-loader', () => ({ imageLoader: gate }));

import CoverArt from './CoverArt.svelte';

afterEach(() => {
  cleanup();
  gate.loaded.clear();
  gate.failed.clear();
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

  it('keeps the placeholder for a cover this session knows fails', async () => {
    gate.failed.add('id=al_3');

    const { container } = render(CoverArt, { props: { coverArt: 'al_3' } });
    await waitFor(() => expect(gate.isFailed).toHaveBeenCalled());

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.hs-art-placeholder')).not.toBeNull();
    expect(gate.load).not.toHaveBeenCalled();
  });

  it('asks once for a failing cover, not again from the next box that shows it', async () => {
    const first = render(CoverArt, { props: { coverArt: 'al_4' } });
    await waitFor(() => expect(gate.load).toHaveBeenCalledTimes(1));
    expect(first.container.querySelector('img')).toBeNull();
    expect(first.container.querySelector('.hs-art-placeholder')).not.toBeNull();

    first.unmount();

    const second = render(CoverArt, { props: { coverArt: 'al_4' } });
    await waitFor(() => expect(gate.isFailed).toHaveBeenCalled());
    expect(second.container.querySelector('img')).toBeNull();
    expect(second.container.querySelector('.hs-art-placeholder')).not.toBeNull();
    expect(gate.load).toHaveBeenCalledTimes(1);
  });

  it('reports a picture the browser could not paint, so the next box skips it', async () => {
    gate.loaded.add('id=al_5');

    const { container } = render(CoverArt, { props: { coverArt: 'al_5' } });
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());

    const image = container.querySelector('img') as HTMLImageElement;
    image.dispatchEvent(new Event('error'));

    await waitFor(() => expect(container.querySelector('img')).toBeNull());
    expect(container.querySelector('.hs-art-placeholder')).not.toBeNull();
    expect(gate.reportFailure).toHaveBeenCalledWith(expect.stringContaining('id=al_5'));
  });
});
