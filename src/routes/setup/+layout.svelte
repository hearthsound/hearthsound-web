<!--
  The wizard's guard.

  The wizard is reachable before anyone exists, so it cannot be guarded the way
  the admin routes are: a server that still needs its first administrator lets
  every browser through - the one-time token in the link gates the first step -
  and a server that has one lets only an administrator walk it again. A browser
  without a session is sent to the sign-in form, which is where the boot
  sequence sends it too; any other account goes home.
-->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  import { navigate } from '#lib/navigation';
  import { getSetupStatus } from '#lib/setup/api';
  import { session } from '#lib/stores/session.svelte';

  /** Props of the layout. */
  interface Props {
    /** The wizard to draw once the browser may walk it. */
    children: Snippet;
  }

  let { children }: Props = $props();

  let allowed = $state(false);

  onMount(async () => {
    const result = await getSetupStatus();
    if ((result.ok && result.value.required) || session.isAdmin) {
      allowed = true;
      return;
    }
    await navigate(session.user === null ? '/login' : '/', { replace: true });
  });
</script>

{#if allowed}
  {@render children()}
{/if}
