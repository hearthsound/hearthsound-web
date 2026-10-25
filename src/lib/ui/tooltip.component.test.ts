/**
 * Tests for the tooltip's gestures: the tap that opens it at once and keeps it
 * for four seconds, the click that tap swallows so the chip's own button does
 * not open, and the long press every other tooltip still waits for (E-G-10).
 *
 * jsdom has no `PointerEvent`, so the events are plain ones carrying the
 * `pointerType` the attachment reads.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { tooltip } from './tooltip.svelte';
import type { TooltipOptions } from './tooltip.svelte';

/** The reason text every case shows. */
const REASON = 'No source has it.';

/** A failure chip inside the button that would otherwise take its clicks. */
interface Fixture {
  /** The chip the tooltip is attached to. */
  chip: HTMLSpanElement;
  /** The button around it, which a tap must not reach. */
  parent: HTMLButtonElement;
  /** Removes the attachment and the markup. */
  cleanup(): void;
}

/**
 * Builds the chip inside a button, with the tooltip attached to the chip.
 *
 * @param options How the tooltip opens.
 * @returns The chip, the button around it and the teardown.
 */
function mountChip(options: TooltipOptions = {}): Fixture {
  const parent = document.createElement('button');
  parent.type = 'button';
  const chip = document.createElement('span');
  chip.textContent = 'Failed';
  parent.append(chip);
  document.body.append(parent);
  const cleanup = tooltip(REASON, options)(chip);
  return {
    chip,
    parent,
    cleanup: () => {
      if (typeof cleanup === 'function') {
        cleanup();
      }
      parent.remove();
    }
  };
}

/**
 * Delivers the pointer event a finger sends.
 *
 * @param element The element to send it to.
 * @param type The event name.
 * @returns Nothing.
 */
function finger(element: Element, type: string): void {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'pointerType', { value: 'touch' });
  element.dispatchEvent(event);
}

/**
 * Returns the tooltip the attachment placed on the page.
 *
 * @returns The tooltip, or `null` while nothing is attached.
 */
function tipElement(): HTMLElement | null {
  return document.querySelector<HTMLElement>('.hs-tooltip');
}

/** The chip the current case mounted, when it did. */
let mounted: Fixture | null = null;

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  mounted?.cleanup();
  mounted = null;
  vi.useRealTimers();
});

describe('tooltip gestures', () => {
  it('shows the reason at once on a tap and keeps it for four seconds', () => {
    mounted = mountChip({ tap: true });

    finger(mounted.chip, 'pointerdown');
    finger(mounted.chip, 'pointerup');

    const tip = tipElement();
    expect(tip).not.toBeNull();
    expect(tip?.hidden).toBe(false);
    expect(tip?.textContent).toBe(REASON);

    vi.advanceTimersByTime(3900);
    expect(tip?.hidden).toBe(false);

    vi.advanceTimersByTime(200);
    expect(tip?.hidden).toBe(true);
  });

  it('keeps a tap on the failure chip from opening the button it sits in', () => {
    mounted = mountChip({ tap: true });
    let opened = 0;
    mounted.parent.addEventListener('click', () => {
      opened += 1;
    });

    finger(mounted.chip, 'pointerup');
    mounted.chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(opened).toBe(0);
    expect(tipElement()?.hidden).toBe(false);

    vi.advanceTimersByTime(4000);
    mounted.chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    expect(opened).toBe(1);
  });

  it('leaves every other tooltip waiting for the long press', () => {
    mounted = mountChip();

    finger(mounted.chip, 'pointerdown');
    finger(mounted.chip, 'pointerup');
    expect(tipElement()?.hidden ?? true).toBe(true);

    finger(mounted.chip, 'pointerdown');
    vi.advanceTimersByTime(500);
    expect(tipElement()?.hidden).toBe(false);
  });
});
