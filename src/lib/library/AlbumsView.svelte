<!--
  The Albums library view (o04, E9).

  The albums with songs in the personal library, in the l08 card grid, paged
  as the reader scrolls (k34). An empty library shows the p08e empty state
  with the upload action only for an account that may upload (o06).
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import { firstPagePlaceholders, nextPagePlaceholders } from '#lib/library/placeholders';
  import { KIND_TITLES } from '#lib/library/kinds';
  import LoadFailure from '#lib/library/LoadFailure.svelte';
  import { canUpload } from '#lib/nav';
  import { navContext } from '#lib/nav-context';
  import { navigate } from '#lib/navigation';
  import { PagedList } from '#lib/paging.svelte';
  import type { PageLoader } from '#lib/paging.svelte';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { availability } from '#lib/stores/availability.svelte';
  import { libraryCounts } from '#lib/stores/library-counts.svelte';
  import { session } from '#lib/stores/session.svelte';
  import { libraryApi, LIBRARY_PAGE_SIZE, PERSONAL_FOLDER } from '#lib/subsonic/library';
  import type { AlbumID3 } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import CardPlaceholders from '#lib/ui/CardPlaceholders.svelte';
  import EndlessLoader from '#lib/ui/EndlessLoader.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  const shell = getShellNavigation();

  const title = KIND_TITLES.albums;

  /** The albums of the view, paged by offset. */
  const albums = new PagedList<AlbumID3>((album) => album.id);

  /** The grid, which the placeholders measure. */
  let albumGrid = $state<HTMLDivElement>();

  /** The library's counts, which size the placeholders. */
  const counts = $derived(libraryCounts.counts);

  const mayUpload = $derived(canUpload(navContext(session)));

  onMount(() => {
    void libraryCounts.refresh();
    albums.start(albumPage());
  });

  /**
   * Builds the read of one page of albums.
   *
   * @returns The loader of the album list.
   */
  function albumPage(): PageLoader<AlbumID3, number> {
    return async (offset) => {
      const start = offset ?? 0;
      const entries = await libraryApi.albums(PERSONAL_FOLDER, start, LIBRARY_PAGE_SIZE);
      availability.remember(entries);
      return {
        items: entries,
        next: entries.length < LIBRARY_PAGE_SIZE ? null : start + entries.length
      };
    };
  }
</script>

<svelte:head>
  <title>{title} - Hearthsound</title>
</svelte:head>

{#snippet uploadAction()}
  <Button icon="custom-upload" onclick={() => void navigate('/library/uploads')}>
    Upload Songs
  </Button>
{/snippet}

<PageHeader {title} class="library-header" onnavigation={shell?.openNavigation} />

{#if albums.failure !== null}
  <LoadFailure retry={() => void albums.loadMore()} />
{:else if albums.done && albums.items.length === 0}
  <StatusPage
    level={2}
    icon="adwaita-album"
    title="No Albums Yet"
    text="Albums with songs in your library show up here."
    action={mayUpload ? uploadAction : undefined}
  />
{:else}
  <EndlessLoader onmore={() => void albums.loadMore()} busy={albums.loading} done={albums.done}>
    <div class="hs-card-grid cards" bind:this={albumGrid}>
      {#each albums.items as album (album.id)}
        <AlbumCard {album} />
      {/each}
      {#if albums.loading}
        <CardPlaceholders
          count={albums.items.length === 0
            ? firstPagePlaceholders(counts?.albums ?? null, LIBRARY_PAGE_SIZE)
            : nextPagePlaceholders(counts?.albums ?? null, albums.items.length, LIBRARY_PAGE_SIZE)}
        />
      {/if}
    </div>
  </EndlessLoader>
{/if}

<style>
  .cards {
    padding: var(--hs-space-3) 0 var(--hs-space-7);
  }

  @media (max-width: 720px) {
    .cards {
      padding-bottom: var(--hs-space-6);
    }
  }
</style>
