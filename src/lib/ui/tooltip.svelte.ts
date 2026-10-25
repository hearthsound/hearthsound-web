/*
 * The k27 tooltip as a Svelte attachment (b04, o07).
 *
 * Attach it to the control whose name is the tooltip text:
 *
 *     <button aria-label="Failed" {@attach tooltip('Failed')}>...</button>
 *
 * The tooltip is the package's `hs-tooltip` element, placed below the control
 * and referenced by the control's `aria-describedby`. It is never focusable
 * and ignores pointer events. Timings are the approved ones: 800 ms on hover,
 * 500 ms on a touch long-press and 1.5 s after the finger lifts, shown at once
 * on keyboard focus and hidden on blur; Escape hides it. A control that is not
 * focusable itself, such as a pill inside a row, uses its nearest focusable
 * ancestor for the keyboard half.
 *
 * The text may be a getter, so a reason that changes while the tooltip is
 * attached is read at the moment it opens.
 *
 * A control that asks for `tap` opens the tooltip at once on a finger and
 * keeps it for four seconds, instead of waiting for a long press (E-G-10).
 */
import type { Attachment } from 'svelte/attachments';

/** The text of a tooltip, or a getter for text that can change. */
export type TooltipText = string | (() => string);

/** How a tooltip opens, beyond the hover, long-press and focus behaviour. */
export interface TooltipOptions {
  /** On a finger, a tap opens the tooltip at once and keeps it for four seconds. */
  tap?: boolean;
}

/** How long the pointer rests on the control before the tooltip opens. */
const HOVER_DELAY = 800;

/** How long a finger rests on the control before the tooltip opens. */
const LONG_PRESS_DELAY = 500;

/** How long the tooltip stays after a long-press ends. */
const TOUCH_HIDE_DELAY = 1500;

/** How long a tap-opened tooltip stays (E-G-10: the failure chip on a phone). */
const TAP_HIDE_DELAY = 4000;

/** The gap below the control, from the 4 px grid (f08-r1). */
const GAP = 4;

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

let sequence = 0;

/**
 * Builds the tooltip attachment for one text.
 *
 * @param text The tooltip text, or a getter for it.
 * @param options How the tooltip opens beyond hover, long press and focus.
 * @returns The attachment to add to the control.
 */
export function tooltip(text: TooltipText, options: TooltipOptions = {}): Attachment<HTMLElement> {
  return (control) => {
    const id = `hs-tooltip-${(sequence += 1)}`;
    const previous = control.getAttribute('aria-describedby');
    const focusTarget = control.matches(FOCUSABLE)
      ? control
      : (control.closest<HTMLElement>(FOCUSABLE) ?? null);

    const tip = document.createElement('span');
    tip.className = 'hs-tooltip';
    tip.id = id;
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;

    let hoverShown = false;
    let touchShown = false;
    let tapShown = false;
    let focusShown = false;
    let shown = false;
    let showTimer: ReturnType<typeof setTimeout> | undefined;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    // Page coordinates are measured from the viewport, so the tooltip lives on
    // the body; it copies the subtree's scheme so a preview column or a nested
    // surface keeps the tooltip's colours.
    const host = control.closest<HTMLElement>('[data-scheme]');
    const schemeName = host?.dataset.scheme;
    if (schemeName !== undefined) {
      tip.dataset.scheme = schemeName;
    }
    document.body.append(tip);

    control.setAttribute('aria-describedby', previous === null ? id : `${previous} ${id}`);

    /** Puts the tooltip under the control and inside the viewport. */
    function place(): void {
      const rect = control.getBoundingClientRect();
      tip.style.left = '0';
      const width = tip.getBoundingClientRect().width;
      const left = Math.max(
        0,
        Math.min(rect.left + (rect.width - width) / 2, window.innerWidth - width)
      );
      tip.style.left = `${Math.round(left + window.scrollX)}px`;
      tip.style.top = `${Math.round(rect.bottom + window.scrollY + GAP)}px`;
    }

    /** Opens the tooltip with the current text. */
    function show(): void {
      tip.textContent = typeof text === 'function' ? text() : text;
      tip.hidden = false;
      shown = true;
      place();
      window.addEventListener('scroll', place, true);
      window.addEventListener('resize', place);
      window.addEventListener('keydown', escape, true);
    }

    /** Closes the tooltip. */
    function hide(): void {
      if (!shown) {
        return;
      }
      shown = false;
      tip.hidden = true;
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('keydown', escape, true);
    }

    /** Forgets every reason the tooltip was open and closes it. */
    function hideAll(): void {
      hoverShown = false;
      touchShown = false;
      tapShown = false;
      focusShown = false;
      clearTimers();
      hide();
    }

    /** Clears both timers. */
    function clearTimers(): void {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    }

    /**
     * Hides on Escape, as b04 records.
     *
     * @param event The keydown event.
     */
    function escape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.stopPropagation();
        hideAll();
      }
    }

    /**
     * Starts the hover pause on a pointer that is not a finger.
     *
     * @param event The pointer event.
     */
    function pointerenter(event: PointerEvent): void {
      if (event.pointerType === 'touch') {
        return;
      }
      clearTimers();
      showTimer = setTimeout(() => {
        hoverShown = true;
        show();
      }, HOVER_DELAY);
    }

    /**
     * Cancels a pending hover and closes a hover-opened tooltip.
     *
     * @param event The pointer event.
     */
    function pointerleave(event: PointerEvent): void {
      if (event.pointerType === 'touch') {
        return;
      }
      clearTimeout(showTimer);
      hoverShown = false;
      if (!touchShown && !focusShown) {
        hide();
      }
    }

    /**
     * Starts the long-press wait on a finger.
     *
     * A tap-mode control never waits for a long press: the gesture it answers
     * is the tap `pointerup` sees (E-G-10).
     *
     * @param event The pointer event.
     */
    function pointerdown(event: PointerEvent): void {
      if (event.pointerType !== 'touch' || options.tap === true) {
        return;
      }
      clearTimers();
      showTimer = setTimeout(() => {
        touchShown = true;
        show();
      }, LONG_PRESS_DELAY);
    }

    /**
     * Opens a tap-mode tooltip for four seconds, or keeps a long-press-opened
     * one for 1.5 s after the finger lifts.
     *
     * @param event The pointer event.
     */
    function pointerup(event: PointerEvent): void {
      if (event.pointerType !== 'touch') {
        return;
      }
      clearTimeout(showTimer);
      if (options.tap === true) {
        clearTimeout(hideTimer);
        tapShown = true;
        show();
        hideTimer = setTimeout(() => {
          tapShown = false;
          if (!hoverShown && !focusShown) {
            hide();
          }
        }, TAP_HIDE_DELAY);
        return;
      }
      if (touchShown) {
        hideTimer = setTimeout(() => {
          touchShown = false;
          if (!hoverShown && !focusShown) {
            hide();
          }
        }, TOUCH_HIDE_DELAY);
      }
    }

    /**
     * Swallows the click a touch tap would deliver to the row's own button.
     *
     * The failure chip sits inside the bar's Show Queue button, so without this
     * a tap that asks for the reason would open the now-playing view instead
     * (E-G-10).
     *
     * @param event The click event.
     */
    function swallow(event: MouseEvent): void {
      if (!tapShown) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    }

    /** Shows the tooltip at once when the control, or its row, takes focus. */
    function focusin(): void {
      clearTimeout(showTimer);
      focusShown = true;
      show();
    }

    /**
     * Hides the tooltip when focus leaves the control or its row.
     *
     * @param event The focusout event.
     */
    function focusout(event: FocusEvent): void {
      const next = event.relatedTarget;
      if (
        next instanceof Node &&
        event.currentTarget instanceof Node &&
        event.currentTarget.contains(next)
      ) {
        return;
      }
      focusShown = false;
      if (!hoverShown && !touchShown) {
        hide();
      }
    }

    control.addEventListener('pointerenter', pointerenter);
    control.addEventListener('pointerleave', pointerleave);
    control.addEventListener('pointerdown', pointerdown);
    control.addEventListener('pointerup', pointerup);
    control.addEventListener('pointercancel', pointerup);
    control.addEventListener('click', swallow, true);
    focusTarget?.addEventListener('focusin', focusin);
    focusTarget?.addEventListener('focusout', focusout);

    return () => {
      clearTimers();
      control.removeEventListener('pointerenter', pointerenter);
      control.removeEventListener('pointerleave', pointerleave);
      control.removeEventListener('pointerdown', pointerdown);
      control.removeEventListener('pointerup', pointerup);
      control.removeEventListener('pointercancel', pointerup);
      control.removeEventListener('click', swallow, true);
      focusTarget?.removeEventListener('focusin', focusin);
      focusTarget?.removeEventListener('focusout', focusout);
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
      window.removeEventListener('keydown', escape, true);
      if (previous === null) {
        control.removeAttribute('aria-describedby');
      } else {
        control.setAttribute('aria-describedby', previous);
      }
      tip.remove();
    };
  };
}
