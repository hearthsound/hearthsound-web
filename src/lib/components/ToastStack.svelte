<!--
  The toast stack (k20-r3 D, l11, l11d).

  The shell's messages, centred in the content column above the player bar or
  the mini card. The region is named "Messages", never takes focus, and lets
  each toast keep its own lifetime (five seconds, paused on hover or focus).
  Errors are announced assertively; everything else politely.
-->
<script lang="ts">
  import { TOAST_LIFETIME_MS, toasts } from '#lib/stores/toasts.svelte';
  import type { ToastLevel } from '#lib/stores/toasts.svelte';
  import Toast from '#lib/ui/Toast.svelte';
  import type { ToastLevel as DesignToastLevel } from '#lib/ui/Toast.svelte';

  /** The store's severities as the toast component's states. */
  const LEVELS: Record<ToastLevel, DesignToastLevel> = {
    info: 'success',
    warn: 'warning',
    error: 'error'
  };

  const newest = $derived(toasts.items[toasts.items.length - 1]?.id);
</script>

<div class="hs-toast-region" role="status" aria-label="Messages">
  {#each toasts.items as toast (toast.id)}
    <Toast
      message={toast.message}
      level={LEVELS[toast.level]}
      newest={toast.id === newest}
      duration={TOAST_LIFETIME_MS}
      onclose={() => toasts.dismiss(toast.id)}
    />
  {/each}
</div>
