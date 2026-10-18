<!--
  The server view.

  The server-wide view is what the server holds beyond the signed-in account's
  own library, and it can be closed for the deployment
  (`privacy.server_browse`). When it is closed the route sends the browser to
  the personal library instead of showing a list nothing can fill.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import { navigate } from '#lib/navigation';
  import { session } from '#lib/stores/session.svelte';

  /** Props of the server-view layout. */
  interface Props {
    /** The content of the active route. */
    children: Snippet;
  }

  let { children }: Props = $props();

  const closed = $derived(
    session.ready && session.systemInfo?.features.serverBrowse === 'disabled'
  );

  $effect(() => {
    if (closed) {
      void navigate('/library/albums', { replaceState: true });
    }
  });
</script>

{#if !closed}
  {@render children()}
{/if}
