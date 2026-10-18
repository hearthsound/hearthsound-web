<!--
  A dialog over the page.

  The views that add or change something gather it in a dialog: the title names
  what is being edited, the content holds the fields and the commands, and the
  page opens and closes it. Clicking beside the dialog closes it, the same as
  the close command.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Props of the dialog. */
  interface Props {
    /** The title shown above the content. */
    title: string;
    /** Closes the dialog. */
    onclose: () => void;
    /** The fields and commands of the dialog. */
    children: Snippet;
  }

  let { title, onclose, children }: Props = $props();

  /**
   * Closes the dialog when the click landed beside it.
   *
   * @param event The click on the backdrop.
   */
  function closeFromBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      onclose();
    }
  }
</script>

<div class="backdrop" role="presentation" onclick={closeFromBackdrop}>
  <div class="dialog" role="dialog" aria-modal="true" aria-label={title} tabindex="-1">
    <header class="dialog-header">
      <h2 class="dialog-title">{title}</h2>
      <button class="dialog-close" type="button" onclick={onclose}>Close</button>
    </header>
    {@render children()}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: var(--space-6) var(--space-4);
    overflow-y: auto;
    background: rgb(0 0 0 / 45%);
  }

  .dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    width: min(36rem, 100%);
    padding: var(--space-5);
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .dialog-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .dialog-title {
    margin: 0;
    font-size: 1.125rem;
  }

  .dialog-close {
    padding: var(--space-1) var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }
</style>
