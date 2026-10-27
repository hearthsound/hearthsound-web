<!--
  Search (p18 B, l14 B).

  The sidebar's pill field drives this page through `?q=`, and on phones the
  page header holds the same field after the back button (l14). The query is
  read from the address and written back to it as the reader types, so a search
  can be shared; both fields follow the one address.

  The answer is the native search: the caller's library first, then the first
  catalog instance, every hit already a stored row. The Top Result card stands
  beside the Songs list above 1000 px and stacks below it (p18), then the
  Albums and Artists shelves, each showing twelve of the thirty hits the page
  asks for. The shelf titles are links to their full-list pages (o04, E10).

  The Top Result is the entity with the highest relevance score the answer
  reports, with an artist, an album and a song ordered in that way when they
  tie (b03).

  No availability pills and no acquisition progress are drawn (privacy-scope-2).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { search, songOf } from '#lib/entities/api';
  import type { AlbumSummary, ArtistSummary, TrackSummary } from '#lib/entities/api';
  import { loadAlbumQueue } from '#lib/library/album-queue';
  import { membership } from '#lib/library/membership.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import type { CollectionQueue, QueueSource } from '#lib/library/queue-source';
  import type { Song } from '#lib/library/song';
  import { navigate } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { topResultOf } from '#lib/search/top-result';
  import type { TopResultView } from '#lib/search/top-result';
  import { returnFromSearch } from '#lib/search-navigation';
  import { SearchField } from '#lib/search-field.svelte';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { availability } from '#lib/stores/availability.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Button from '#lib/ui/Button.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import SectionHeader from '#lib/ui/SectionHeader.svelte';
  import Shelf from '#lib/ui/Shelf.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import TextField from '#lib/ui/TextField.svelte';
  import TopResultCard from '#lib/ui/TopResultCard.svelte';

  /** How many hits of each kind one search asks for. */
  const SEARCH_LIMIT = 30;

  /** How many albums and artists the shelves show of the answer. */
  const SHELF_SIZE = 12;

  /** How long the page waits after the last keystroke before it searches. */
  const QUERY_DELAY_MS = 300;

  /** The l07 breakpoint: below it the field moves into the page header (p18). */
  const PHONE_QUERY = '(max-width: 720px)';

  const shell = getShellNavigation();

  /** Whether the phone layout draws the back button and the page's own field. */
  let phone = $state(window.matchMedia(PHONE_QUERY).matches);

  /** What the field holds and what the next search asks for. */
  const field = new SearchField(page.url.searchParams.get('q') ?? '');

  let tracks = $state<TrackSummary[]>([]);
  let albums = $state<AlbumSummary[]>([]);
  let artists = $state<ArtistSummary[]>([]);
  /** The rows the Songs list draws. */
  const songs = $derived(tracks.map(songOf));

  /** The query whose answer is on screen, or `null` before the first answer. */
  let resultQuery = $state<string | null>(null);
  let loading = $state((page.url.searchParams.get('q') ?? '').trim() !== '');
  let failure = $state<string | null>(null);

  let generation = 0;

  $effect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const update = (): void => {
      phone = media.matches;
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });

  // The address is the query's other half: the sidebar field, a shared link,
  // Back and Forward all arrive as a new `q`. The field keeps a keystroke typed
  // while the page's own write lands.
  $effect(() => {
    const pathname = page.url.pathname;
    const asked = page.url.searchParams.get('q') ?? '';
    if (pathname !== '/search') {
      return;
    }
    untrack(() => field.adopt(asked));
  });

  // The page searches a pause after the last keystroke, and writes the same
  // query to the address so the results can be shared.
  $effect(() => {
    const text = field.value.trim();
    const mine = ++generation;
    if (text === '') {
      tracks = [];
      albums = [];
      artists = [];
      resultQuery = null;
      failure = null;
      loading = false;
      return;
    }
    loading = true;
    failure = null;
    const timer = setTimeout(() => {
      publish(text);
      void runSearch(text, mine);
    }, QUERY_DELAY_MS);
    return () => clearTimeout(timer);
  });

  /** The entity the Top Result card shows, or `null` before an answer (b03). */
  const topResult = $derived(topResultOf(tracks, albums, artists, resultQuery));

  /** The shelf link to the full album list for the answer on screen. */
  const albumList = $derived(
    resultQuery === null ? null : `/search/albums?q=${encodeURIComponent(resultQuery)}`
  );

  /** The shelf link to the full artist list for the answer on screen. */
  const artistList = $derived(
    resultQuery === null ? null : `/search/artists?q=${encodeURIComponent(resultQuery)}`
  );

  /**
   * Writes the query to the address, replacing the previous search entry. The
   * navigation does not reset focus or scroll: the write happens while the user
   * may still be typing in this field.
   *
   * @param text The trimmed query.
   */
  function publish(text: string): void {
    const route = field.publish(text, page.url.searchParams.get('q') ?? '');
    if (route !== null) {
      void navigate(route, { replace: true, reset: false });
    }
  }

  /**
   * Runs one search and renders its answer, unless a newer one started.
   *
   * @param text The query to search for.
   * @param mine The generation of this search.
   */
  async function runSearch(text: string, mine: number): Promise<void> {
    try {
      const answer = await search(text, { limit: SEARCH_LIMIT });
      if (mine !== generation) {
        return;
      }
      tracks = answer.tracks;
      albums = answer.albums;
      artists = answer.artists;
      availability.remember(tracks);
      membership.remember([...albums, ...artists, ...tracks]);
      resultQuery = text;
      failure = null;
      loading = false;
    } catch (error) {
      if (mine !== generation) {
        return;
      }
      tracks = [];
      albums = [];
      artists = [];
      resultQuery = null;
      failure = error instanceof Error ? error.message : 'The search could not be run.';
      loading = false;
    }
  }

  /** Retries the query that failed (o03). */
  function retry(): void {
    const text = field.value.trim();
    if (text === '') {
      return;
    }
    const mine = ++generation;
    loading = true;
    failure = null;
    void runSearch(text, mine);
  }

  /**
   * Plays one of the found tracks, with the rest of the results as the queue.
   *
   * A song the list no longer holds plays nothing: a newer answer replaced the
   * list, and starting a different track instead would be a surprise.
   *
   * @param song The track to play.
   */
  function play(song: Song): void {
    const index = songs.findIndex((entry) => entry.id === song.id);
    if (index < 0) {
      return;
    }
    player.play(songs.map(queueItemOf), index);
  }

  /**
   * Queues a collection and starts at its head.
   *
   * @param source The collection to queue.
   * @param what The entity kind, for the failure toast.
   */
  async function playCollection(source: QueueSource, what: string): Promise<void> {
    await playEntity(loadCollection(source), what);
  }

  /**
   * Plays the queue a read answers with, or reports why it could not.
   *
   * @param read The pending queue.
   * @param what The entity kind, for the failure toast.
   */
  async function playEntity(read: Promise<CollectionQueue | null>, what: string): Promise<void> {
    try {
      const collection = await read;
      if (collection !== null && collection.items.length > 0) {
        player.play(collection.items, collection.startIndex);
      }
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not play this ${what}: ${error.message}`
          : `Could not play this ${what}.`,
        'error'
      );
    }
  }

  /**
   * Empties the page's own field and returns to the page before it.
   *
   * @param event The input event that emptied the field.
   */
  function typed(event: Event): void {
    if ((event.currentTarget as HTMLInputElement).value.trim() === '') {
      returnFromSearch();
    }
  }

  /**
   * Escape in the phone page's field returns to the page before the search.
   *
   * @param event The key press.
   */
  function fieldKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    returnFromSearch();
  }

  /**
   * Starts the entity the Top Result card shows.
   *
   * @param result The card's entity.
   */
  function playTop(result: TopResultView): void {
    const entity = result.entity;
    if (entity.kind === 'artist') {
      void playCollection(`artist:${entity.artist.id}`, 'artist');
    } else if (entity.kind === 'album') {
      void playEntity(loadAlbumQueue(entity.album.id), 'album');
    } else {
      const index = songs.findIndex((song) => song.id === entity.track.id);
      if (index >= 0) {
        player.play(songs.map(queueItemOf), index);
      }
    }
  }
</script>

<svelte:head>
  <title>Search - Hearthsound</title>
</svelte:head>

{#snippet pageField()}
  <TextField
    kind="search"
    label="Search"
    placeholder="Song, album or artist"
    bind:value={field.value}
    oninput={typed}
    onclear={returnFromSearch}
    onkeydown={fieldKey}
  />
{/snippet}

{#snippet retryAction()}
  <Button onclick={retry}>Retry</Button>
{/snippet}

{#snippet rowPlaceholders(count: number)}
  {#each Array.from({ length: count }, (_, index) => index) as row (row)}
    <li class="hs-track-row" aria-hidden="true">
      <span class="hs-track-row__lead">
        <Skeleton width="40px" height="40px" radius="art-small" />
      </span>
      <span class="hs-track-row__text">
        <Skeleton width="60%" height="12px" />
        <Skeleton width="35%" height="10px" />
      </span>
      <span class="hs-track-row__album"><Skeleton width="50%" height="10px" /></span>
      <span class="hs-track-row__status"></span>
      <span></span>
      <span class="hs-track-row__duration"><Skeleton width="30px" height="10px" /></span>
    </li>
  {/each}
{/snippet}

<PageHeader
  class="search-header"
  title={phone ? undefined : 'Search'}
  onback={phone ? returnFromSearch : undefined}
  onnavigation={phone ? undefined : shell?.openNavigation}
  actions={phone ? pageField : undefined}
/>

{#if failure !== null}
  <StatusPage
    level={2}
    alert
    icon="adwaita-error"
    title="Could Not Load This Page"
    text="The server did not answer. Try again in a moment."
    action={retryAction}
  />
{:else if field.value.trim() === ''}
  <div class="idle"></div>
{:else if loading}
  <div aria-busy="true">
    <span class="hs-visually-hidden" role="status">Loading...</span>
    <ul class="hs-track-list songs">
      {@render rowPlaceholders(5)}
    </ul>
  </div>
{:else if resultQuery !== null && songs.length + albums.length + artists.length === 0}
  <StatusPage
    level={2}
    icon="adwaita-search"
    title="No Results"
    text={`Nothing matched "${resultQuery}". Check the spelling, or try fewer words.`}
  />
{:else if resultQuery !== null}
  <div class="hs-top-result-row search-top">
    <div class="top-result">
      <SectionHeader title="Top Result" level={2} />
      {#if topResult !== null}
        <TopResultCard
          name={topResult.name}
          kind={topResult.kind}
          artist={topResult.artist}
          href={topResult.href}
          art={topResult.art}
          icon={topResult.icon}
          onplay={() => playTop(topResult)}
        />
      {/if}
    </div>

    {#if songs.length > 0}
      <div class="top-songs">
        <SectionHeader title="Songs" level={2} />
        <ul class="hs-track-list songs">
          {#each songs as song (song.id)}
            <SongRow {song} {play} libraryMark />
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  {#if (albums.length > 0 && albumList !== null) || (artists.length > 0 && artistList !== null)}
    <div class="shelves">
      {#if albums.length > 0 && albumList !== null}
        <Shelf title="Albums" href={albumList} flush>
          {#each albums.slice(0, SHELF_SIZE) as album (album.id)}
            <AlbumCard {album} libraryMark />
          {/each}
        </Shelf>
      {/if}
      {#if artists.length > 0 && artistList !== null}
        <Shelf title="Artists" href={artistList} flush>
          {#each artists.slice(0, SHELF_SIZE) as artist (artist.id)}
            <ArtistCard {artist} libraryMark showAlbumCount />
          {/each}
        </Shelf>
      {/if}
    </div>
  {/if}
{/if}

<style>
  /* Layout glue only: the shell holds the page off the window edge, so the
     header aligns to that margin and the bodies add their own spacing. */
  :global(.search-header) {
    padding-inline: 0;
  }

  /* On phones the page field fills the header after the back button (l14). */
  :global(.search-header .hs-page-actions) {
    flex: 1;
    min-width: 0;
  }

  /* The idle page keeps the content column's minimum without inventing copy. */
  .idle {
    flex: 1;
  }

  /* p18: the package's row keeps the Top Result's column and the 1000 px
     stacking; the page owns the margins, so its own inline padding goes. */
  :global(.hs-top-result-row.search-top) {
    padding: 0;
    align-items: start;
    gap: var(--hs-space-6);
  }

  .top-result,
  .top-songs {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
    min-width: 0;
  }

  /* The song list fills its grid at the page margin, as the library lists do:
     the rows' own lead inset is pulled out so the art sits on the content
     line and the hover tile reaches into the gutter. */
  .songs {
    margin: 0 0 0 calc(-1 * var(--hs-track-row-inset));
    padding: 0;
  }

  .shelves {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-6);
    padding: var(--hs-space-6) 0 var(--hs-space-7);
  }

  /* The shelves sit at the page margin: the package's Home header padding
     belongs to a page without the shell's own margins (l13, k33). */
  .shelves :global(.hs-home-section .hs-section-header) {
    padding: 0 0 var(--hs-space-3);
  }

  @media (max-width: 720px) {
    .shelves {
      padding-bottom: var(--hs-space-6);
    }

    .songs {
      padding-bottom: 0;
    }
  }
</style>
