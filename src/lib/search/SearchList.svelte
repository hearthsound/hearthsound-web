<!--
  A search full list (o04, E10).

  The Search page's Albums and Artists shelf titles open these pages: every
  matching entity for the same query, in the l08 card grid, with the l03 back
  button. The list pages against the same `search3` answer, so a scroll brings
  the next window of matches; while it loads, k09b placeholders hold the space
  (k34). The query is read from `?q=` and follows the address.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import { PagedList } from '#lib/paging.svelte';
  import type { PageLoader } from '#lib/paging.svelte';
  import { goBack } from '#lib/navigation';
  import { availability } from '#lib/stores/availability.svelte';
  import { subsonic } from '#lib/subsonic/client';
  import type { AlbumID3, ArtistID3, Search3Response } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import CardPlaceholders from '#lib/ui/CardPlaceholders.svelte';
  import EndlessLoader from '#lib/ui/EndlessLoader.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  /** Props of the full list. */
  interface Props {
    /** Which matching entities the page lists. */
    kind: 'albums' | 'artists';
  }

  let { kind }: Props = $props();

  /** How many entities one page of the list asks for. */
  const PAGE_SIZE = 60;

  /** The matching albums, paged by offset. */
  const albums = new PagedList<AlbumID3>((album) => album.id);

  /** The matching artists, paged by offset. */
  const artists = new PagedList<ArtistID3>((artist) => artist.id);

  /** The page's grid, which the placeholders measure. */
  let grid = $state<HTMLDivElement>();

  const title = $derived(kind === 'albums' ? 'Albums' : 'Artists');
  const query = $derived((page.url.searchParams.get('q') ?? '').trim());
  const active = $derived(kind === 'albums' ? albums : artists);

  // A new query starts the list over; a page read for the previous query is
  // dropped when it answers.
  $effect(() => {
    const text = query;
    const source = kind;
    if (text === '') {
      return;
    }
    untrack(() => {
      if (source === 'albums') {
        albums.start(albumPage(text));
      } else {
        artists.start(artistPage(text));
      }
    });
  });

  /**
   * Builds the read of one page of matching albums.
   *
   * @param text The query to search for.
   * @returns The loader of the album list.
   */
  function albumPage(text: string): PageLoader<AlbumID3, number> {
    return async (offset) => {
      const start = offset ?? 0;
      const answer = await subsonic.get<Search3Response>('search3', {
        query: text,
        songCount: 0,
        artistCount: 0,
        albumCount: PAGE_SIZE,
        albumOffset: start
      });
      const entries = answer.searchResult3?.album ?? [];
      availability.remember(entries);
      return { items: entries, next: entries.length === 0 ? null : start + entries.length };
    };
  }

  /**
   * Builds the read of one page of matching artists.
   *
   * @param text The query to search for.
   * @returns The loader of the artist list.
   */
  function artistPage(text: string): PageLoader<ArtistID3, number> {
    return async (offset) => {
      const start = offset ?? 0;
      const answer = await subsonic.get<Search3Response>('search3', {
        query: text,
        songCount: 0,
        albumCount: 0,
        artistCount: PAGE_SIZE,
        artistOffset: start
      });
      const entries = answer.searchResult3?.artist ?? [];
      availability.remember(entries);
      return { items: entries, next: entries.length === 0 ? null : start + entries.length };
    };
  }

  /** Returns to the search results that opened this list. */
  function back(): void {
    goBack(query === '' ? '/search' : `/search?q=${encodeURIComponent(query)}`);
  }
</script>

<svelte:head>
  <title>{title} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void active.loadMore()}>Retry</Button>
{/snippet}

<PageHeader {title} class="search-list-header" onback={back} />

{#if query === ''}
  <div class="idle"></div>
{:else if active.failure !== null}
  <StatusPage
    level={2}
    alert
    icon="adwaita-error"
    title="Could Not Load This Page"
    text="The server did not answer. Try again in a moment."
    action={retryAction}
  />
{:else if active.items.length === 0 && !active.done}
  <div aria-busy="true">
    <span class="hs-visually-hidden" role="status">Loading...</span>
    <div class="hs-card-grid cards" bind:this={grid}>
      <CardPlaceholders items={0} {grid} artist={kind === 'artists'} rows={2} />
    </div>
  </div>
{:else if active.done && active.items.length === 0}
  <StatusPage
    level={2}
    icon="adwaita-search"
    title="No Results"
    text={`Nothing matched "${query}". Check the spelling, or try fewer words.`}
  />
{:else}
  <EndlessLoader onmore={() => void active.loadMore()} busy={active.loading} done={active.done}>
    <div class="hs-card-grid cards" bind:this={grid}>
      {#if kind === 'albums'}
        {#each albums.items as album (album.id)}
          <AlbumCard {album} />
        {/each}
      {:else}
        {#each artists.items as artist (artist.id)}
          <ArtistCard {artist} />
        {/each}
      {/if}
      {#if active.loading}
        <CardPlaceholders items={active.items.length} {grid} artist={kind === 'artists'} />
      {/if}
    </div>
  </EndlessLoader>
{/if}

<style>
  /* Layout glue only: the shell holds the page off the window edge, so the
     header aligns to that margin and the grid adds its own spacing. */
  :global(.search-list-header) {
    padding-inline: 0;
  }

  .cards {
    padding: var(--hs-space-3) 0 var(--hs-space-7);
  }

  .idle {
    flex: 1;
  }

  @media (max-width: 720px) {
    .cards {
      padding-bottom: var(--hs-space-6);
    }
  }
</style>
