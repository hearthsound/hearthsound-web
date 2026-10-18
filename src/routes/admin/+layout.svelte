<!--
  The administrator's routes.

  An account that does not administer the server never sees them: the layout
  draws nothing and sends the browser to the client's home, so a route that is
  opened by hand answers the same as the navigation, which does not offer it.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import { navigate } from '#lib/navigation';
  import { session } from '#lib/stores/session.svelte';

  /** Props of the layout. */
  interface Props {
    /** The route to draw. */
    children: Snippet;
  }

  let { children }: Props = $props();

  $effect(() => {
    if (session.ready && !session.isAdmin) {
      void navigate('/', { replaceState: true });
    }
  });
</script>

{#if session.isAdmin}
  {@render children()}
{/if}
