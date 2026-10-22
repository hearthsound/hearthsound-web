<!--
  The personal library.

  The route segment names the list to show. A segment that names no list, and
  the uploads view for an account that may not upload, answer as the p27 Not
  Found page instead of drawing an empty list (o06, E9).
-->
<script lang="ts">
  import { page } from '$app/state';

  import LibraryView from '#lib/library/LibraryView.svelte';
  import { KIND_TITLES, libraryKind } from '#lib/library/kinds';
  import { canUpload } from '#lib/nav';
  import { navContext } from '#lib/nav-context';
  import { navigate } from '#lib/navigation';
  import { session } from '#lib/stores/session.svelte';
  import Button from '#lib/ui/Button.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  const kind = $derived(libraryKind(page.params.kind));
  const mayUpload = $derived(canUpload(navContext(session)));
  const missing = $derived(kind === null || (kind === 'uploads' && !mayUpload));
  const title = $derived(missing || kind === null ? 'Page Not Found' : KIND_TITLES[kind]);
</script>

<svelte:head>
  <title>{title} - Hearthsound</title>
</svelte:head>

{#snippet goHome()}
  <Button onclick={() => void navigate('/')}>Go Home</Button>
{/snippet}

{#if missing}
  <StatusPage
    icon="adwaita-search"
    title="Page Not Found"
    text="This address does not match any page."
    action={goHome}
  />
{:else if kind !== null}
  {#key kind}
    <LibraryView {kind} />
  {/key}
{/if}
