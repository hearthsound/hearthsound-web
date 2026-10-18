<!--
  The toast stack: the messages the shell shows in its corner.
-->
<script lang="ts">
  import { toasts } from '#lib/stores/toasts.svelte';
</script>

{#each toasts.items as toast (toast.id)}
  <div
    class="toast"
    class:toast-error={toast.level === 'error'}
    class:toast-warn={toast.level === 'warn'}
  >
    <p class="toast-message">{toast.message}</p>
    <button class="toast-dismiss" type="button" onclick={() => toasts.dismiss(toast.id)}>
      Dismiss
    </button>
  </div>
{/each}

<style>
  .toast {
    display: flex;
    gap: var(--space-3);
    align-items: flex-start;
    justify-content: space-between;
    padding: var(--space-3);
    background: var(--color-bg-raised);
    border: var(--border-width) solid var(--color-border);
    border-left: 3px solid var(--color-accent);
    border-radius: var(--radius);
    box-shadow: 0 2px 8px rgb(0 0 0 / 15%);
  }

  .toast-warn {
    border-left-color: var(--color-accent);
  }

  .toast-error {
    border-left-color: var(--color-danger);
  }

  .toast-message {
    margin: 0;
  }

  .toast-dismiss {
    flex: none;
    padding: 0;
    color: var(--color-fg-muted);
    font: inherit;
    background: none;
    border: none;
    cursor: pointer;
  }
</style>
