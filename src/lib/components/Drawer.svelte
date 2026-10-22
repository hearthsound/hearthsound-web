<!--
  The phone navigation drawer.

  The sidebar becomes a 300 px drawer on phones, opened by the page header's
  "Open Navigation" button or the "/" shortcut (l01-r1, c02). The drawer takes
  focus when it opens, keeps Tab inside itself until it closes, and closes on
  Escape or a press on the scrim. The shell owns the open state and the focus
  return to the trigger; this component owns the dialog surface and its focus
  trap.

  Usage:
  `<Drawer {open} onclose={closeDrawer}>{@render sidebar(true)}</Drawer>`
-->
<script lang="ts">
  import { tick, type Snippet } from 'svelte';

  /** Props of the drawer. */
  interface Props {
    /** Whether the drawer covers the page. */
    open: boolean;
    /** Closes the drawer; the shell also returns focus to the trigger. */
    onclose: () => void;
    /** The drawer's content, usually the phone sidebar. */
    children: Snippet;
  }

  let { open, onclose, children }: Props = $props();

  /** What the drawer cycles through while it is open. */
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let panel = $state<HTMLDivElement>();

  // The drawer takes focus when it opens, so the keyboard continues in it: its
  // field (the search field) when it has one, otherwise its first control. A
  // selector list would match whichever comes first in the document, which is
  // the lockup link above the field.
  $effect(() => {
    if (!open) {
      return;
    }
    void tick().then(() => {
      (
        panel?.querySelector<HTMLElement>('input') ?? panel?.querySelector<HTMLElement>(FOCUSABLE)
      )?.focus();
    });
  });

  /**
   * Handles the drawer's keys: Escape closes it and Tab stays inside it.
   *
   * @param event The key press.
   */
  function keydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) {
      return;
    }
    if (event.key === 'Escape') {
      const target = event.target;
      const typing =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');
      if (typing) {
        return;
      }
      event.preventDefault();
      onclose();
      return;
    }
    if (event.key === 'Tab') {
      trap(event);
    }
  }

  /**
   * Keeps Tab inside the open drawer until it closes.
   *
   * @param event The Tab press.
   */
  function trap(event: KeyboardEvent): void {
    if (panel === undefined) {
      return;
    }
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const outside = !(active instanceof Node) || !panel.contains(active);
    if (event.shiftKey && (outside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (outside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }
</script>

<svelte:window onkeydown={keydown} />

{#if open}
  <button
    class="hs-scrim hs-scrim--drawer shell-drawer-scrim"
    type="button"
    aria-label="Close Navigation"
    onclick={onclose}
  ></button>
  <div class="hs-drawer" role="dialog" aria-modal="true" aria-label="Navigation" bind:this={panel}>
    {@render children()}
  </div>
{/if}

<style>
  .shell-drawer-scrim {
    padding: 0;
    border: 0;
    cursor: default;
  }
</style>
