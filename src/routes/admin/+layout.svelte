<!--
  The administrator's routes.

  An account that does not administer the server never sees them: the layout
  raises the p27 Forbidden status (403), which the root error page draws inside
  the shell. A route that is opened by hand therefore answers the same as the
  navigation, which does not offer it, but explains why instead of silently
  dropping the browser on Home.
-->
<script lang="ts">
  import { error } from '@sveltejs/kit';
  import type { Snippet } from 'svelte';

  import { session } from '#lib/stores/session.svelte';

  /** Props of the layout. */
  interface Props {
    /** The route to draw. */
    children: Snippet;
  }

  let { children }: Props = $props();

  $effect(() => {
    if (session.user !== null && !session.isAdmin) {
      error(403, 'Not Allowed');
    }
  });
</script>

{#if session.isAdmin}
  {@render children()}
{/if}
