<!--
  The Albums library view (o04, E9).

  The albums with songs in the personal library, in the l08 card grid, paged
  as the reader scrolls (k34). The header carries the sort menu: the order and
  the genre live in the address, so a reload and Back show the same list. An
  empty library shows the p08e empty state with the upload action only for an
  account that may upload (o06).
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { page } from '$app/state';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import { firstPagePlaceholders, nextPagePlaceholders } from '#lib/library/placeholders';
  import { KIND_TITLES } from '#lib/library/kinds';
  import LoadFailure from '#lib/library/LoadFailure.svelte';
  import SortMenu from '#lib/library/SortMenu.svelte';
  import { albumListTypeOf, albumNarrow, albumRoute, readAlbumQuery } from '#lib/library/sort';
  import type { AlbumQuery } from '#lib/library/sort';
  import { canUpload } from '#lib/nav';
  import { navContext } from '#lib/nav-context';
  import { navigate } from '#lib/navigation';
  import { PagedList } from '#lib/paging.svelte';
  import type { PageLoader } from '#lib/paging.svelte';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { availability } from '#lib/stores/availability.svelte';
  import { libraryCounts } from '#lib/stores/library-counts.svelte';
  import { session } from '#lib/stores/session.svelte';
  import {
    listAlbumsBy,
    listGenres,
    LIBRARY_PAGE_SIZE,
    PERSONAL_FOLDER
  } from '#lib/subsonic/library';
  import type { AlbumID3, Genre } from '#lib/subsonic/types';
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

  /** The order and genre the address names, which the sort menu shows. */
  const query = $derived(readAlbumQuery(page.url.search));

  /** The genres the collection holds, which the sort menu offers. */
  let genres = $state<Genre[]>([]);

  onMount(() => {
    void libraryCounts.refresh();
    void readGenres();
  });

  // The list starts over whenever the address names another order or genre,
  // which is what keeps a reload and Back on the list the reader chose.
  $effect(() => {
    const current = query;
    untrack(() => albums.start(albumPage(current)));
  });

  /**
   * Reads the genres the collection holds.
   *
   * A read that fails leaves the menu without a genre list rather than failing
   * the page: the orders are still there and the albums still load.
   */
  async function readGenres(): Promise<void> {
    try {
      genres = await listGenres(PERSONAL_FOLDER);
    } catch {
      genres = [];
    }
  }

  /**
   * Shows the order and genre the reader chose.
   *
   * A choice the list already shows only closes the menu: navigating would add
   * a history entry and read the first page again for the same list.
   *
   * @param next The order and genre to show.
   */
  function chooseQuery(next: AlbumQuery): void {
    if (next.sort === query.sort && next.genre === query.genre) {
      return;
    }
    void navigate(albumRoute(next));
  }

  /**
   * Builds the read of one page of albums in the chosen order.
   *
   * @param current The order and genre the address names.
   * @returns The loader of the album list.
   */
  function albumPage(current: AlbumQuery): PageLoader<AlbumID3, number> {
    return async (offset) => {
      const start = offset ?? 0;
      const entries = await listAlbumsBy(
        albumListTypeOf(current),
        PERSONAL_FOLDER,
        start,
        LIBRARY_PAGE_SIZE,
        albumNarrow(current)
      );
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

{#snippet headerActions()}
  <SortMenu {query} {genres} onchoose={chooseQuery} />
{/snippet}

{#snippet uploadAction()}
  <Button icon="custom-upload" onclick={() => void navigate('/library/uploads')}>
    Upload Songs
  </Button>
{/snippet}

<PageHeader
  {title}
  class="library-header"
  onnavigation={shell?.openNavigation}
  actions={albums.failure === null ? headerActions : undefined}
/>

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
