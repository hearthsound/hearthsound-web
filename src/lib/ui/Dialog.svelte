<!--
  A dialog over the page (k19 C, l11c A, p05-r1 A, o05 A).

  The scrim dims the page and a centred card holds the title, the content and
  the commands. On phones the card floats at the bottom edge. There is never a
  close button: Escape, a click on the scrim or the caller's Cancel command
  closes it. Focus moves into the first field (or Cancel for an alert) and is
  trapped until the dialog unmounts, then returns to the command that opened it.

  The caller supplies the action row as the `footer` snippet; an action dialog
  uses the suggested button and an alert the destructive one.

  Usage:
  ```
  <Dialog title="Add folder" onclose={close} footer={footerSnippet}>
    <form ...>...</form>
  </Dialog>
  ```
-->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';

  /** Props of the dialog. */
  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'title' | 'onclose'> {
    /** The dialog's title and accessible name. */
    title: string;
    /** Closes the dialog; the caller unmounts it. */
    onclose: () => void;
    /** Widens the card to 640 px for the instance dialog (p05-r1). */
    wide?: boolean;
    /** Renders an alert dialog: `role="alertdialog"` with a destructive action. */
    alert?: boolean;
    /** The alert text, referenced by `aria-describedby`. */
    description?: string;
    /** The action row; buttons land in `hs-dialog__footer`. */
    footer?: Snippet;
    /** The dialog's content, usually a form. */
    children: Snippet;
  }

  let {
    title,
    onclose,
    wide = false,
    alert = false,
    description,
    footer,
    children,
    class: extra = '',
    ...rest
  }: Props = $props();

  const titleId = $props.id();
  const descriptionId = `${titleId}-description`;

  /** Everything Tab may land on inside the card. */
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /** The fields focus moves to first, before any command. */
  const FIELDS =
    '[autofocus], [data-autofocus], input:not([disabled]):not([type="hidden"]), ' +
    'select:not([disabled]), textarea:not([disabled])';

  let dialog = $state<HTMLDivElement | null>(null);
  let opener: HTMLElement | null = null;

  /**
   * Lists the card's visible tab stops in document order.
   *
   * @returns The focusable elements, empty when the card holds none.
   */
  function focusables(): HTMLElement[] {
    if (dialog === null) {
      return [];
    }
    return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (element) => element.getClientRects().length > 0
    );
  }

  /**
   * Returns where focus goes when the dialog opens.
   *
   * An alert focuses its Cancel command, which is the last footer button; an
   * action dialog focuses its first field, or its first command when it has no
   * field. The card itself is the fallback.
   *
   * @returns The element to focus, or `null` before the card mounted.
   */
  function initialTarget(): HTMLElement | null {
    if (dialog === null) {
      return null;
    }
    const field = [...dialog.querySelectorAll<HTMLElement>(FIELDS)].find(
      (element) => element.getClientRects().length > 0
    );
    const commands = [
      ...dialog.querySelectorAll<HTMLElement>('.hs-dialog__footer button:not([disabled])')
    ];
    if (alert) {
      // The first command is Cancel: an alert must never open on its
      // destructive action (k19).
      return commands[0] ?? dialog;
    }
    return field ?? commands[0] ?? dialog;
  }

  /**
   * Handles Escape and keeps Tab inside the card.
   *
   * @param event The key press.
   */
  function keydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onclose();
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const items = focusables();
    const first = items[0];
    const last = items[items.length - 1];
    if (first === undefined || last === undefined) {
      event.preventDefault();
      dialog?.focus();
      return;
    }
    const active = document.activeElement;
    const outside = dialog === null || !(active instanceof Node) || !dialog.contains(active);
    if (event.shiftKey && (outside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (outside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  onMount(() => {
    opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    initialTarget()?.focus();
    return () => {
      if (opener !== null && document.contains(opener)) {
        opener.focus();
      }
    };
  });
</script>

<svelte:window onkeydown={keydown} />

<div class="hs-scrim" role="presentation" onclick={onclose}></div>

<div
  {...rest}
  class="hs-dialog {extra}"
  class:hs-dialog--wide={wide}
  role={alert ? 'alertdialog' : 'dialog'}
  aria-modal="true"
  aria-label={title}
  aria-labelledby={titleId}
  aria-describedby={description === undefined ? undefined : descriptionId}
  tabindex="-1"
  bind:this={dialog}
>
  <h2 class="hs-dialog__title" id={titleId}>{title}</h2>
  {#if description !== undefined}
    <p id={descriptionId}>{description}</p>
  {/if}
  {@render children()}
  {#if footer}
    <div class="hs-dialog__footer">{@render footer()}</div>
  {/if}
</div>
