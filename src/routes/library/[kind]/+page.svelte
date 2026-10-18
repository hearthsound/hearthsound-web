<!--
  The personal library.

  The route segment names the list to show: the tracks, the albums, the
  artists, the liked entities or the playlists the signed-in account holds. A
  segment that names no list shows nothing instead of an empty one.
-->
<script lang="ts">
  import { page } from '$app/state';

  import LibraryView from '#lib/library/LibraryView.svelte';
  import { libraryKind } from '#lib/library/kinds';
  import { PERSONAL_FOLDER } from '#lib/subsonic/library';

  const kind = $derived(libraryKind(page.params.kind));
</script>

<svelte:head>
  <title>Library - Hearthsound</title>
</svelte:head>

{#if kind === null}
  <section>
    <h1>Library</h1>
    <p>There is no such library view.</p>
  </section>
{:else}
  <LibraryView {kind} folder={PERSONAL_FOLDER} />
{/if}
