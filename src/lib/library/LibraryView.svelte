<!--
  A library view.

  The route's segment names one of the personal library's lists, and each list
  is its own component: the songs, the albums, the artists, the liked entities,
  the playlists and the uploads page. Every child draws the approved design's
  page - its header, the p08e empty state under the title, the o03 status page
  when a read fails, and k34 endless loading for the lists the server pages -
  so this component only dispatches to the list the route asked for.

  The uploads page is the only upload surface (p13): the drop panel, the rows
  of files in flight and the uploaded songs below them. An account that may not
  upload never reaches it; the route answers as the p27 Not Found instead.
-->
<script lang="ts">
  import type { LibraryKind } from '#lib/library/kinds';
  import AlbumsView from '#lib/library/AlbumsView.svelte';
  import ArtistsView from '#lib/library/ArtistsView.svelte';
  import LikedView from '#lib/library/LikedView.svelte';
  import PlaylistsView from '#lib/library/PlaylistsView.svelte';
  import SongsView from '#lib/library/SongsView.svelte';
  import UploadsView from '#lib/library/UploadsView.svelte';

  /** Props of a library view. */
  interface Props {
    /** The list to show. */
    kind: LibraryKind;
  }

  let { kind }: Props = $props();
</script>

{#if kind === 'songs'}
  <SongsView />
{:else if kind === 'albums'}
  <AlbumsView />
{:else if kind === 'artists'}
  <ArtistsView />
{:else if kind === 'liked'}
  <LikedView />
{:else if kind === 'playlists'}
  <PlaylistsView />
{:else}
  <UploadsView />
{/if}

<style>
  /* Layout glue only: the shell already holds the page off the window edge, so
     the header aligns to that margin and the bodies add their own spacing. */
  :global(.library-header) {
    padding-inline: 0;
  }
</style>
