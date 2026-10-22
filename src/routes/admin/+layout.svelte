<!--
  The administrator's routes.

  An account that does not administer the server never sees them: the sibling
  load raises the p27 Forbidden status (403), which the root error page draws
  inside the shell. The guard runs before this layout renders, so a member
  opening an administration address by hand sees the explanation instead of an
  empty frame; the shell's own boot sequence answers a browser without a
  session by sending it to sign-in.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import { session } from '#lib/stores/session.svelte';

  /** Props of the layout. */
  interface Props {
    /** The route to draw. */
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

{#if session.isAdmin}
  {@render children()}
{/if}
