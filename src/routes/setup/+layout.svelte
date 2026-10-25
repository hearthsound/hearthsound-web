<!--
  The wizard's guard.

  The wizard is reachable before anyone exists, so it cannot be guarded the way
  the admin routes are: a server that still needs its first administrator lets
  every browser through - the one-time token in the link gates the first step -
  and a server that has one sends an administrator home with a toast, because
  Admin > Folders and Admin > Plugins cover the same work. A browser without a
  session is sent to the sign-in form, which is where the boot sequence sends it
  too; any other account goes home. A read that failed proves nothing, so an
  administrator it could not answer for is sent home without the toast.
-->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';

  import { navigate } from '#lib/navigation';
  import { getSetupStatus } from '#lib/setup/api';
  import { setupVerdict } from '#lib/setup/steps';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';

  /** Props of the layout. */
  interface Props {
    /** The wizard to draw once the browser may walk it. */
    children: Snippet;
  }

  let { children }: Props = $props();

  let allowed = $state(false);

  onMount(async () => {
    const result = await getSetupStatus();
    const verdict = setupVerdict(result.ok && result.value.required, session.isAdmin);
    if (verdict === 'wizard') {
      allowed = true;
      return;
    }
    if (verdict === 'home') {
      if (result.ok) {
        toasts.push('Setup is already complete.');
      }
      await navigate('/', { replace: true });
      return;
    }
    await navigate(session.user === null ? '/login' : '/', { replace: true });
  });
</script>

{#if allowed}
  {@render children()}
{/if}
