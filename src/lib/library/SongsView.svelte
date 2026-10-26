<!--
  The Songs library view (o04, E9).

  Every track of the personal library as k12 rows in the list context, paged
  as the reader scrolls (k34). Play and Shuffle queue the whole collection
  through the server's collection queue (queue-api), so a library of thousands
  of tracks plays in full from the first click. The header carries the sort
  menu, and the order lives in the address: the list and the queue the buttons
  read ask for the same order, so Play starts at the row the reader sees. The
  header's actions disappear when a read fails, and an empty library shows the
  p08e empty state with the upload action only for an account that may upload
  (o06).
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { page } from '$app/state';

  import SongRow from '#lib/components/SongRow.svelte';
  import { KIND_TITLES, LIBRARY_KIND_INFO } from '#lib/library/kinds';
  import { firstPagePlaceholders, nextPagePlaceholders } from '#lib/library/placeholders';
  import LoadFailure from '#lib/library/LoadFailure.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import type { QueueSource } from '#lib/library/queue-source';
  import SortMenu from '#lib/library/SortMenu.svelte';
  import { SONG_SORTS, readSongQuery, songRoute } from '#lib/library/sort';
  import type { SongSortId } from '#lib/library/sort';
  import TrackRowPlaceholders from '#lib/library/TrackRowPlaceholders.svelte';
  import { canUpload } from '#lib/nav';
  import { navContext } from '#lib/nav-context';
  import { navigate } from '#lib/navigation';
  import { PagedList } from '#lib/paging.svelte';
  import type { PageLoader } from '#lib/paging.svelte';
  import { player } from '#lib/player/player.svelte';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { availability } from '#lib/stores/availability.svelte';
  import { libraryCounts } from '#lib/stores/library-counts.svelte';
  import { session } from '#lib/stores/session.svelte';
  import { libraryApi, LIBRARY_PAGE_SIZE, PERSONAL_FOLDER } from '#lib/subsonic/library';
  import type { Child } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import EndlessLoader from '#lib/ui/EndlessLoader.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  const shell = getShellNavigation();

  const title = KIND_TITLES.songs;
  const queueSource: QueueSource = LIBRARY_KIND_INFO.songs.queueSource ?? 'songs';

  /** The tracks of the view, paged by offset. */
  const songs = new PagedList<Child>((song) => song.id);

  const mayUpload = $derived(canUpload(navContext(session)));

  /** The library's counts, which size the placeholders. */
  const counts = $derived(libraryCounts.counts);

  /** The order the address names, which the sort menu shows. */
  const query = $derived(readSongQuery(page.url.search));

  onMount(() => {
    void libraryCounts.refresh();
  });

  // The list starts over whenever the address names another order, which is
  // what keeps a reload and Back on the list the reader chose.
  $effect(() => {
    const sort = query;
    untrack(() => songs.start(songPage(sort)));
  });

  /**
   * Builds the read of one page of tracks.
   *
   * @param sort The order the address names.
   * @returns The loader of the track list.
   */
  function songPage(sort: SongSortId): PageLoader<Child, number> {
    return async (offset) => {
      const start = offset ?? 0;
      const entries = await libraryApi.songs(PERSONAL_FOLDER, start, LIBRARY_PAGE_SIZE, sort);
      availability.remember(entries);
      return {
        items: entries,
        next: entries.length < LIBRARY_PAGE_SIZE ? null : start + entries.length
      };
    };
  }

  /**
   * Queues the whole collection and starts at one of its tracks.
   *
   * The queue is read in the order the list shows, so the first row is what
   * Play starts with and the rows below it follow in the same order.
   *
   * @param from The track to start at; absent starts at the head.
   * @param shuffle Whether to switch the player's shuffled order on.
   */
  async function playCollection(from?: string, shuffle = false): Promise<void> {
    const collection = await loadCollection(queueSource, from, { sort: query });
    if (collection === null || collection.items.length === 0) {
      return;
    }
    player.play(collection.items, collection.startIndex);
    player.setShuffle(shuffle);
  }
</script>

<svelte:head>
  <title>{title} - Hearthsound</title>
</svelte:head>

{#snippet headerActions()}
  <Button
    variant="suggested"
    header
    icon="adwaita-play"
    label="Play"
    disabled={songs.items.length === 0}
    onclick={() => void playCollection(undefined, false)}
  >
    Play
  </Button>
  <Button
    header
    icon="adwaita-shuffle"
    label="Shuffle"
    disabled={songs.items.length === 0}
    onclick={() => void playCollection(undefined, true)}
  >
    Shuffle
  </Button>
  <SortMenu
    sorts={SONG_SORTS}
    sort={query}
    onsort={(id) => {
      if (id !== query) {
        void navigate(songRoute(id as SongSortId));
      }
    }}
  />
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
  actions={songs.failure === null ? headerActions : undefined}
/>

{#if songs.failure !== null}
  <LoadFailure retry={() => void songs.loadMore()} />
{:else if songs.done && songs.items.length === 0}
  <StatusPage
    level={2}
    icon="adwaita-song"
    title="No Songs Yet"
    text="Songs you like, save, add to a playlist or upload show up here."
    action={mayUpload ? uploadAction : undefined}
  />
{:else}
  <EndlessLoader onmore={() => void songs.loadMore()} busy={songs.loading} done={songs.done}>
    <ul class="hs-track-list songs">
      {#each songs.items as song (song.id)}
        <SongRow {song} play={() => void playCollection(song.id)} />
      {/each}
      {#if songs.loading}
        <TrackRowPlaceholders
          count={songs.items.length === 0
            ? firstPagePlaceholders(counts?.songs ?? null, LIBRARY_PAGE_SIZE)
            : nextPagePlaceholders(counts?.songs ?? null, songs.items.length, LIBRARY_PAGE_SIZE)}
        />
      {/if}
    </ul>
  </EndlessLoader>
{/if}

<style>
  /* A list fills its own grid at the page margin: the browser's list margin
     and indent would inset its rows from the header and from each other. The
     row keeps its own 6 px lead inset so its hover tile can start left of the
     art; pulling the list out by that inset puts the art on the content line,
     under the page title, and lets the tile extend into the gutter. */
  .songs {
    margin: 0 0 0 calc(-1 * var(--hs-track-row-inset));
    padding: 0 0 var(--hs-space-6);
  }

  @media (max-width: 720px) {
    .songs {
      padding: 0 0 var(--hs-space-5);
    }
  }
</style>
