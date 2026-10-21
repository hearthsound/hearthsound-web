<!--
  A Home shelf's full list (o04, E8).

  Every k33 Home title opens `/home/<section-id>`: the section's own title in
  the page header, the l03 back button, and the shelf's items as the page type
  draws them - albums and artists in the l08 card grid, songs as k12 rows in
  the list context. Album orders page as the reader scrolls (k34); the Liked
  shelves and the random draws answer in one call because their endpoints carry
  no cursor. A failed read is the page-wide o03 status page, an empty list the
  page type's approved empty state, and an id no section owns answers as the
  p27 Not Found page.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import { canUpload } from '#lib/nav';
  import { navigate } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import type { AlbumID3, ArtistID3, Child } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import CardPlaceholders from '#lib/ui/CardPlaceholders.svelte';
  import EndlessLoader from '#lib/ui/EndlessLoader.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  import { HOME_PAGE_SIZE, loadHomePage } from '#lib/home/data';
  import { HOME_SECTION_BY_ID } from '#lib/home/sections';

  const id = $derived(page.params.section ?? '');
  const section = $derived(HOME_SECTION_BY_ID[id]);

  let albums = $state<AlbumID3[]>([]);
  let artists = $state<ArtistID3[]>([]);
  let songs = $state<Child[]>([]);
  /** The cursor of the next page, or `null` when the list has ended. */
  let next = $state<number | null>(0);
  let loading = $state(true);
  let failure = $state<string | null>(null);
  let generation = 0;

  let albumGrid = $state<HTMLDivElement>();
  let artistGrid = $state<HTMLDivElement>();

  const mayUpload = $derived(
    canUpload({
      isAdmin: session.isAdmin,
      systemInfo: session.systemInfo,
      user: session.user
    })
  );

  const items = $derived(
    section?.kind === 'artist'
      ? artists.length
      : section?.kind === 'song'
        ? songs.length
        : albums.length
  );

  $effect(() => {
    // The route's section is the read: a new id starts the list over.
    void id;
    untrack(() => start());
  });

  /** Starts the list over at its first page. */
  function start(): void {
    generation += 1;
    albums = [];
    artists = [];
    songs = [];
    next = 0;
    failure = null;
    loading = false;
    if (section !== undefined) {
      void loadMore();
    }
  }

  /** Reads the next page and appends it, keeping a row that arrived twice. */
  async function loadMore(): Promise<void> {
    const current = section;
    if (current === undefined || loading || next === null) {
      return;
    }
    const mine = generation;
    const cursor = next;
    loading = true;
    failure = null;
    try {
      const answer = await loadHomePage(current.id, cursor, HOME_PAGE_SIZE);
      if (mine !== generation) {
        return;
      }
      const knownAlbums = new Set(albums.map((album) => album.id));
      albums = [...albums, ...answer.albums.filter((album) => !knownAlbums.has(album.id))];
      const knownArtists = new Set(artists.map((artist) => artist.id));
      artists = [...artists, ...answer.artists.filter((artist) => !knownArtists.has(artist.id))];
      const knownSongs = new Set(songs.map((song) => song.id));
      songs = [...songs, ...answer.songs.filter((song) => !knownSongs.has(song.id))];
      next = answer.next;
    } catch {
      if (mine === generation) {
        failure = 'The server did not answer.';
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  /** Returns to the page that opened this list. */
  function back(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      void navigate('/');
    }
  }

  /**
   * Queues a song and starts at the picked row.
   *
   * Liked Songs queues the whole liked collection through the server; the
   * random list queues what the page loaded.
   *
   * @param song The picked track.
   */
  async function playSong(song: Child): Promise<void> {
    if (id === 'liked-songs') {
      try {
        const collection = await loadCollection('liked', song.id);
        if (collection !== null && collection.items.length > 0) {
          player.play(collection.items, collection.startIndex);
        }
      } catch (error) {
        toasts.push(
          error instanceof Error && error.message !== ''
            ? `Could not play these songs: ${error.message}`
            : 'Could not play these songs.',
          'error'
        );
      }
      return;
    }
    const index = songs.findIndex((entry) => entry.id === song.id);
    player.play(songs.map(queueItemOf), index < 0 ? 0 : index);
  }
</script>

<svelte:head>
  <title>{section?.title ?? 'Page Not Found'} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void loadMore()}>Retry</Button>
{/snippet}

{#snippet goHome()}
  <Button onclick={() => void navigate('/')}>Go Home</Button>
{/snippet}

{#snippet uploadAction()}
  <Button icon="custom-upload" onclick={() => void navigate('/library/uploads')}>
    Upload Songs
  </Button>
{/snippet}

{#snippet loadFailure()}
  <div class="state">
    <StatusPage
      alert
      icon="adwaita-error"
      title="Could Not Load This Page"
      text="The server did not answer. Try again in a moment."
      action={retryAction}
    />
  </div>
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

{#if section === undefined}
  <div class="state">
    <StatusPage
      icon="adwaita-search"
      title="Page Not Found"
      text="This address does not match any page."
      action={goHome}
    />
  </div>
{:else}
  <PageHeader title={section.title} class="home-list-header" onback={back} />

  {#if failure !== null}
    {@render loadFailure()}
  {:else if section.kind === 'song'}
    {#if loading && songs.length === 0}
      <div class="loading" aria-busy="true">
        <span class="hs-visually-hidden" role="status">Loading...</span>
        <ul class="hs-track-list songs">
          {@render rowPlaceholders(8)}
        </ul>
      </div>
    {:else if items === 0}
      <div class="state">
        <StatusPage
          level={2}
          icon="adwaita-song"
          title="No Songs Yet"
          text="Songs you like, save, add to a playlist or upload show up here."
          action={mayUpload ? uploadAction : undefined}
        />
      </div>
    {:else}
      <EndlessLoader onmore={() => void loadMore()} busy={loading} done={next === null}>
        <ul class="hs-track-list songs">
          {#each songs as song (song.id)}
            <SongRow {song} play={(picked) => void playSong(picked)} />
          {/each}
          {#if loading}
            {@render rowPlaceholders(3)}
          {/if}
        </ul>
      </EndlessLoader>
    {/if}
  {:else if section.kind === 'artist'}
    {#if loading && artists.length === 0}
      <div class="loading" aria-busy="true">
        <span class="hs-visually-hidden" role="status">Loading...</span>
        <div class="hs-card-grid cards" bind:this={artistGrid}>
          <CardPlaceholders items={0} grid={artistGrid} artist rows={2} />
        </div>
      </div>
    {:else if artists.length === 0}
      <div class="state">
        <StatusPage
          level={2}
          icon="adwaita-artist"
          title="No Artists Yet"
          text="Artists with songs in your library show up here."
          action={mayUpload ? uploadAction : undefined}
        />
      </div>
    {:else}
      <EndlessLoader onmore={() => void loadMore()} busy={loading} done={next === null}>
        <div class="hs-card-grid cards">
          {#each artists as artist (artist.id)}
            <ArtistCard {artist} />
          {/each}
        </div>
      </EndlessLoader>
    {/if}
  {:else if loading && items === 0}
    <div class="loading" aria-busy="true">
      <span class="hs-visually-hidden" role="status">Loading...</span>
      <div class="hs-card-grid cards" bind:this={albumGrid}>
        <CardPlaceholders items={0} grid={albumGrid} rows={2} />
      </div>
    </div>
  {:else if items === 0}
    <div class="state">
      {#if section.kind === 'playlist'}
        <StatusPage
          level={2}
          icon="adwaita-playlist"
          title="No Playlists Yet"
          text="Playlists you create show up here."
        />
      {:else}
        <StatusPage
          level={2}
          icon="adwaita-album"
          title="No Albums Yet"
          text="Albums with songs in your library show up here."
          action={mayUpload ? uploadAction : undefined}
        />
      {/if}
    </div>
  {:else}
    <EndlessLoader onmore={() => void loadMore()} busy={loading} done={next === null}>
      <div class="hs-card-grid cards" bind:this={albumGrid}>
        {#each albums as album (album.id)}
          <AlbumCard {album} />
        {/each}
        {#if loading}
          <CardPlaceholders {items} grid={albumGrid} />
        {/if}
      </div>
    </EndlessLoader>
  {/if}
{/if}

<style>
  /* Layout glue only: the shell holds the page off the window edge. */
  :global(.home-list-header) {
    padding-inline: 0;
  }

  .cards {
    padding: var(--hs-space-3) 0 var(--hs-space-7);
  }

  .songs {
    margin: 0 0 0 calc(-1 * var(--hs-track-row-inset));
    padding: 0 0 var(--hs-space-6);
    list-style: none;
  }

  .state {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 60vh;
  }

  @media (max-width: 720px) {
    .songs {
      margin-inline: calc(-1 * var(--hs-space-3));
    }
  }
</style>
