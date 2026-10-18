<!--
  The server view.

  The route segment names the list to show: the tracks, the albums or the
  artists the server holds beyond the signed-in account's own library. The
  layout above sends the browser away when the deployment has closed this view.
-->
<script lang="ts">
  import { page } from '$app/state';

  import LibraryView from '#lib/library/LibraryView.svelte';
  import { libraryKind } from '#lib/library/kinds';
  import { SERVER_FOLDER } from '#lib/subsonic/library';

  const kind = $derived(libraryKind(page.params.kind));
  const browsable = $derived(kind === 'songs' || kind === 'albums' || kind === 'artists');
</script>

<svelte:head>
  <title>Server - Hearthsound</title>
</svelte:head>

{#if kind === null || !browsable}
  <section>
    <h1>Server</h1>
    <p>There is no such server view.</p>
  </section>
{:else}
  <LibraryView {kind} folder={SERVER_FOLDER} />
{/if}
