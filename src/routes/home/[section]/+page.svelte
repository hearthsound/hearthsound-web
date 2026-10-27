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
  import { albumLabels } from '#lib/library/editions';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import { canUpload } from '#lib/nav';
  import { navContext } from '#lib/nav-context';
  import { goBack, navigate } from '#lib/navigation';
  import { PagedList } from '#lib/paging.svelte';
  import type { PageLoader } from '#lib/paging.svelte';
  import { player } from '#lib/player/player.svelte';
  import { coverArtUrl } from '#lib/player/stream';
  import { queueItemOf } from '#lib/player/tracks';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import type { Song } from '#lib/library/song';
  import type { AlbumID3, ArtistID3, Child, Playlist } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import CardPlaceholders from '#lib/ui/CardPlaceholders.svelte';
  import EndlessLoader from '#lib/ui/EndlessLoader.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import PlaylistCard from '#lib/ui/PlaylistCard.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  import { HOME_PAGE_SIZE, loadHomePage } from '#lib/home/data';
  import { HOME_SECTION_BY_ID, type HomeSection } from '#lib/home/sections';

  /** One item of the section's full list, tagged by the kind it belongs to. */
  type HomeItem =
    | { kind: 'album'; id: string; album: AlbumID3 }
    | { kind: 'artist'; id: string; artist: ArtistID3 }
    | { kind: 'playlist'; id: string; playlist: Playlist }
    | { kind: 'song'; id: string; song: Child };

  const id = $derived(page.params.section ?? '');
  const section = $derived(HOME_SECTION_BY_ID[id]);

  /** The section's items, paged by offset. */
  const rows = new PagedList<HomeItem>((item) => `${item.kind}:${item.id}`);

  /** Whether the page's first read was asked for. */
  let started = $state(false);

  let albumGrid = $state<HTMLDivElement>();
  let artistGrid = $state<HTMLDivElement>();

  const mayUpload = $derived(canUpload(navContext(session)));

  const albums = $derived(
    rows.items.flatMap((item) => (item.kind === 'album' ? [item.album] : []))
  );
  const artists = $derived(
    rows.items.flatMap((item) => (item.kind === 'artist' ? [item.artist] : []))
  );
  const songs = $derived(rows.items.flatMap((item) => (item.kind === 'song' ? [item.song] : [])));
  /** What each card calls its album and says under it, including a collision's year. */
  const labels = $derived(albumLabels(albums));
  const playlists = $derived(
    rows.items.flatMap((item) => (item.kind === 'playlist' ? [item.playlist] : []))
  );

  /** The title the read named, which is the seed artist's name on one shelf. */
  let readTitle = $state<string | null>(null);
  const title = $derived(readTitle ?? section?.title ?? 'Page Not Found');

  const items = $derived(
    section?.kind === 'artist'
      ? artists.length
      : section?.kind === 'song'
        ? songs.length
        : section?.kind === 'playlist'
          ? playlists.length
          : albums.length
  );

  /** Whether the page still belongs to the first read. */
  const busy = $derived(!started || rows.loading);

  $effect(() => {
    // The route's section is the read: a new id starts the list over, and a
    // page read for the previous section is dropped when it answers.
    const current = section;
    void id;
    untrack(() => {
      started = true;
      readTitle = null;
      rows.start(pageOf(current));
    });
  });

  /**
   * Builds the read of one page of a section's list.
   *
   * @param current The section to read, when the route names one.
   * @returns The loader of the section's items.
   */
  function pageOf(current: HomeSection | undefined): PageLoader<HomeItem, number> {
    if (current === undefined) {
      return async () => ({ items: [], next: null });
    }
    return async (cursor) => {
      const answer = await loadHomePage(current.id, cursor ?? 0, HOME_PAGE_SIZE);
      readTitle = answer.title ?? null;
      return {
        items: [
          ...answer.albums.map((album) => ({ kind: 'album' as const, id: album.id, album })),
          ...answer.artists.map((artist) => ({ kind: 'artist' as const, id: artist.id, artist })),
          ...answer.playlists.map((playlist) => ({
            kind: 'playlist' as const,
            id: playlist.id,
            playlist
          })),
          ...answer.songs.map((song) => ({ kind: 'song' as const, id: song.id, song }))
        ],
        next: answer.next
      };
    };
  }

  /** Returns to the page that opened this list. */
  function back(): void {
    goBack('/');
  }

  /**
   * Queues a song and starts at the picked row.
   *
   * Liked Songs queues the whole liked collection through the server; the
   * random list queues what the page loaded.
   *
   * @param song The picked track.
   */
  async function playSong(song: Song): Promise<void> {
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
  <title>{title} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void rows.loadMore()}>Retry</Button>
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
  <PageHeader {title} class="home-list-header" onback={back} />

  {#if rows.failure !== null}
    {@render loadFailure()}
  {:else if section.kind === 'song'}
    {#if busy && songs.length === 0}
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
      <EndlessLoader onmore={() => void rows.loadMore()} busy={rows.loading} done={rows.done}>
        <ul class="hs-track-list songs">
          {#each songs as song (song.id)}
            <SongRow {song} play={(picked) => void playSong(picked)} />
          {/each}
          {#if rows.loading}
            {@render rowPlaceholders(3)}
          {/if}
        </ul>
      </EndlessLoader>
    {/if}
  {:else if section.kind === 'artist'}
    {#if busy && artists.length === 0}
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
      <EndlessLoader onmore={() => void rows.loadMore()} busy={rows.loading} done={rows.done}>
        <div class="hs-card-grid cards">
          {#each artists as artist (artist.id)}
            <ArtistCard {artist} />
          {/each}
        </div>
      </EndlessLoader>
    {/if}
  {:else if section.kind === 'playlist'}
    {#if busy && playlists.length === 0}
      <div class="loading" aria-busy="true">
        <span class="hs-visually-hidden" role="status">Loading...</span>
        <div class="hs-card-grid cards" bind:this={albumGrid}>
          <CardPlaceholders items={0} grid={albumGrid} rows={2} />
        </div>
      </div>
    {:else if playlists.length === 0}
      <div class="state">
        <StatusPage
          level={2}
          icon="adwaita-playlist"
          title="No Playlists Yet"
          text="Playlists you create show up here."
        />
      </div>
    {:else}
      <EndlessLoader onmore={() => void rows.loadMore()} busy={rows.loading} done={rows.done}>
        <div class="hs-card-grid cards" bind:this={albumGrid}>
          {#each playlists as playlist (playlist.id)}
            <PlaylistCard
              name={playlist.name}
              songs={playlist.songCount ?? 0}
              href={`/playlist/${playlist.id}`}
              covers={playlist.coverArt === undefined ? [] : [coverArtUrl(playlist.coverArt, 300)]}
            />
          {/each}
          {#if rows.loading}
            <CardPlaceholders {items} grid={albumGrid} />
          {/if}
        </div>
      </EndlessLoader>
    {/if}
  {:else if busy && items === 0}
    <div class="loading" aria-busy="true">
      <span class="hs-visually-hidden" role="status">Loading...</span>
      <div class="hs-card-grid cards" bind:this={albumGrid}>
        <CardPlaceholders items={0} grid={albumGrid} rows={2} />
      </div>
    </div>
  {:else if items === 0}
    <div class="state">
      <StatusPage
        level={2}
        icon="adwaita-album"
        title="No Albums Yet"
        text="Albums with songs in your library show up here."
        action={mayUpload ? uploadAction : undefined}
      />
    </div>
  {:else}
    <EndlessLoader onmore={() => void rows.loadMore()} busy={rows.loading} done={rows.done}>
      <div class="hs-card-grid cards" bind:this={albumGrid}>
        {#each albums as album (album.id)}
          <AlbumCard
            {album}
            title={labels.titles.get(album.id)}
            subtitle={labels.subtitles.get(album.id)}
          />
        {/each}
        {#if rows.loading}
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
