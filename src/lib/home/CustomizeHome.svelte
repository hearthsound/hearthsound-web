<!--
  The Customize Home dialog (p07b, k19, k30).

  Opened from the account row menu. One grey group lists the 13 sections in the
  p07 order, each with an always-visible drag handle, its title and a switch;
  the four Discovery sections add the muted note that they appear only when
  they have something to show. Dragging or moving a row with the keyboard
  (Space, Up and Down) reorders it, and the single suggested "Done" closes the
  dialog. Every toggle and move is written to `localStorage` at once, so there
  is no save command (l13c B).
-->
<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import ReorderList from '#lib/ui/ReorderList.svelte';

  import { homeLayout } from './layout.svelte';
  import { HOME_DISCOVERY_NOTE, type HomeSection } from './sections';

  /** Props of the dialog. */
  interface Props {
    /** Closes the dialog and returns focus to the account row. */
    close: () => void;
  }

  let { close }: Props = $props();

  const preferences = homeLayout();

  /** The rows in their current order, bound so a drag or key move holds. */
  let rows = $state<HomeSection[]>(preferences.sections);

  /**
   * Flips one section's switch and stores the choice.
   *
   * @param row The section to show or hide.
   */
  function toggle(row: HomeSection): void {
    preferences.setShown(row.id, preferences.hidden.includes(row.id));
  }

  /**
   * Stores the order after a drag or a keyboard move.
   *
   * @param items The rows in their new order.
   */
  function reorder(items: HomeSection[]): void {
    preferences.reorder(items.map((item) => item.id));
  }
</script>

{#snippet footer()}
  <Button variant="suggested" onclick={close}>Done</Button>
{/snippet}

<Dialog title="Customize Home" onclose={close} {footer} class="customize-home">
  <div class="list">
    <ReorderList
      label="Customize Home"
      bind:items={rows}
      handles="always"
      numbered={false}
      onchange={reorder}
    >
      {#snippet children(row)}
        <span class="hs-setting-row__text">
          <span id="home-row-{row.id}">{row.title}</span>
          {#if row.discovery}
            <span class="hs-setting-row__subtitle">{HOME_DISCOVERY_NOTE}</span>
          {/if}
        </span>
        <button
          class="hs-switch"
          type="button"
          role="switch"
          aria-checked={!preferences.hidden.includes(row.id)}
          aria-labelledby="home-row-{row.id}"
          onclick={() => toggle(row)}
        ></button>
      {/snippet}
    </ReorderList>
  </div>
</Dialog>

<style>
  /* Layout glue only: the dialog caps its height and keeps the title and Done
     in place while the grey group scrolls (p07b). The package's dialog already
     scrolls as a whole; here it hands that scrolling to the list. */
  :global(.hs-dialog.customize-home) {
    overflow: hidden;
  }

  .list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  /* The package tints the switch's own `.hs-choice` row while the switch holds
     keyboard focus. This dialog puts the switch at the end of a k30 row
     instead, so the row carries that same tint here. */
  .list :global(.hs-setting-row:has(.hs-switch:focus-visible)) {
    background: var(--hs-accent-tint);
  }
</style>
