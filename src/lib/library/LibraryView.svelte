<!--
  A library view.

  One component renders every list of the personal library and of the server
  view: the tracks, the albums, the artists, the liked entities and the
  playlists of one scope. The tracks and the albums load one page at a time
  through a "Load more" control rather than growing as the reader scrolls, and
  every entity a response carries is remembered so its availability badge is
  right.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { resolve } from '$app/paths';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { KIND_TITLES } from '#lib/library/kinds';
  import type { LibraryKind } from '#lib/library/kinds';
  import { PagedList } from '#lib/library/paging.svelte';
  import type { PageLoader } from '#lib/library/paging.svelte';
  import { clientRoute } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { availability } from '#lib/stores/availability.svelte';
  import { events } from '#lib/stores/events.svelte';
  import { libraryApi, LIBRARY_PAGE_SIZE } from '#lib/subsonic/library';
  import type { AlbumID3, ArtistID3, Child, Playlist, Starred2 } from '#lib/subsonic/types';

  /** Props of a library view. */
  interface Props {
    /** The list to show. */
    kind: LibraryKind;
    /** The music folder to read: the personal library or the server view. */
    folder: number;
  }

  let { kind, folder }: Props = $props();

  /** The tracks of the songs view. */
  const songs = new PagedList<Child>();

  /** The albums of the albums view. */
  const albums = new PagedList<AlbumID3>();

  let artists = $state<ArtistID3[]>([]);
  let starred = $state<Starred2>({});
  let playlists = $state<Playlist[]>([]);
  let loading = $state(false);
  let failure = $state<string | null>(null);

  let generation = 0;

  const title = $derived(KIND_TITLES[kind]);

  $effect(() => {
    const current = kind;
    const scope = folder;
    const mine = ++generation;
    untrack(() => void load(current, scope, mine));
  });

  onMount(() =>
    events.on('library.changed', () => {
      // A like, an unsave or an upload changes what the lists hold; the liked
      // view is the one that shows a list of memberships rather than of
      // entities a scope holds, so it is read again.
      if (kind === 'liked') {
        void load('liked', folder, ++generation);
      }
    })
  );

  /**
   * Reads the list a view shows.
   *
   * A read whose answer arrives after the view changed is dropped, so a slow
   * list never overwrites the one the reader asked for.
   *
   * @param current The list to read.
   * @param scope The music folder to read.
   * @param mine The generation of this read.
   */
  async function load(current: LibraryKind, scope: number, mine: number): Promise<void> {
    failure = null;
    if (current === 'songs') {
      songs.start(songPage(scope));
      return;
    }
    if (current === 'albums') {
      albums.start(albumPage(scope));
      return;
    }
    loading = true;
    try {
      if (current === 'artists') {
        const answer = await libraryApi.artists(scope);
        if (mine !== generation) {
          return;
        }
        artists = answer;
        availability.remember(answer);
      } else if (current === 'liked') {
        const answer = await libraryApi.starred();
        if (mine !== generation) {
          return;
        }
        starred = answer;
        availability.remember([
          ...(answer.song ?? []),
          ...(answer.album ?? []),
          ...(answer.artist ?? [])
        ]);
      } else {
        const answer = await libraryApi.playlists();
        if (mine !== generation) {
          return;
        }
        playlists = answer;
      }
    } catch (error) {
      if (mine === generation) {
        failure = error instanceof Error ? error.message : 'The list could not be read.';
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  /**
   * Builds the read of one page of tracks.
   *
   * @param scope The music folder to read.
   * @returns The loader of the track list.
   */
  function songPage(scope: number): PageLoader<Child, number> {
    return async (offset) => {
      const start = offset ?? 0;
      const entries = await libraryApi.songs(scope, start, LIBRARY_PAGE_SIZE);
      availability.remember(entries);
      return {
        items: entries,
        next: entries.length < LIBRARY_PAGE_SIZE ? null : start + entries.length
      };
    };
  }

  /**
   * Builds the read of one page of albums.
   *
   * @param scope The music folder to read.
   * @returns The loader of the album list.
   */
  function albumPage(scope: number): PageLoader<AlbumID3, number> {
    return async (offset) => {
      const start = offset ?? 0;
      const entries = await libraryApi.albums(scope, start, LIBRARY_PAGE_SIZE);
      availability.remember(entries);
      return {
        items: entries,
        next: entries.length < LIBRARY_PAGE_SIZE ? null : start + entries.length
      };
    };
  }

  /**
   * Plays one of the listed tracks, with the loaded list as the queue.
   *
   * @param song The track to play.
   */
  function play(song: Child): void {
    const items = songs.items;
    const index = items.findIndex((entry) => entry.id === song.id);
    player.play(items.map(queueItemOf), index < 0 ? 0 : index);
  }
</script>

<svelte:head>
  <title>{title} - Hearthsound</title>
</svelte:head>

{#snippet more(list: PagedList<Child> | PagedList<AlbumID3>)}
  {#if list.failure !== null}
    <p class="view-failure" role="alert">{list.failure}</p>
  {/if}
  {#if !list.done}
    <button class="view-more" type="button" disabled={list.loading} onclick={() => list.loadMore()}>
      {list.loading ? 'Loading...' : 'Load more'}
    </button>
  {/if}
{/snippet}

<section>
  <h1>{title}</h1>

  {#if failure !== null}
    <p class="view-failure" role="alert">{failure}</p>
  {/if}

  {#if kind === 'songs'}
    {#if songs.items.length === 0 && !songs.loading && songs.failure === null}
      <p class="view-hint">Nothing is here yet.</p>
    {/if}
    <ul class="view-songs">
      {#each songs.items as song (song.id)}
        <SongRow {song} {play} />
      {/each}
    </ul>
    {@render more(songs)}
  {:else if kind === 'albums'}
    {#if albums.items.length === 0 && !albums.loading && albums.failure === null}
      <p class="view-hint">Nothing is here yet.</p>
    {/if}
    <div class="view-cards">
      {#each albums.items as album (album.id)}
        <AlbumCard {album} />
      {/each}
    </div>
    {@render more(albums)}
  {:else if kind === 'artists'}
    {#if artists.length === 0 && !loading}
      <p class="view-hint">Nothing is here yet.</p>
    {/if}
    <div class="view-cards">
      {#each artists as artist (artist.id)}
        <ArtistCard {artist} />
      {/each}
    </div>
  {:else if kind === 'liked'}
    {#if (starred.song ?? []).length === 0 && (starred.album ?? []).length === 0 && (starred.artist ?? []).length === 0 && !loading}
      <p class="view-hint">Nothing is liked yet.</p>
    {/if}
    {#if (starred.song ?? []).length > 0}
      <h2>Songs</h2>
      <ul class="view-songs">
        {#each starred.song ?? [] as song (song.id)}
          <SongRow {song} {play} />
        {/each}
      </ul>
    {/if}
    {#if (starred.album ?? []).length > 0}
      <h2>Albums</h2>
      <div class="view-cards">
        {#each starred.album ?? [] as album (album.id)}
          <AlbumCard {album} />
        {/each}
      </div>
    {/if}
    {#if (starred.artist ?? []).length > 0}
      <h2>Artists</h2>
      <div class="view-cards">
        {#each starred.artist ?? [] as artist (artist.id)}
          <ArtistCard {artist} />
        {/each}
      </div>
    {/if}
  {:else}
    {#if playlists.length === 0 && !loading}
      <p class="view-hint">Nothing is here yet.</p>
    {/if}
    <ul class="view-playlists">
      {#each playlists as playlist (playlist.id)}
        <li class="view-playlist">
          <a href={resolve(clientRoute(`/playlist/${playlist.id}`))}>{playlist.name}</a>
          <span>{playlist.songCount ?? 0} tracks</span>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .view-hint,
  .view-failure {
    color: var(--color-fg-muted);
  }

  .view-failure {
    color: var(--color-danger);
  }

  .view-songs {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .view-cards {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }

  .view-more {
    margin-top: var(--space-4);
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .view-more:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .view-playlists {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .view-playlist {
    display: flex;
    gap: var(--space-3);
    align-items: baseline;
    padding: var(--space-1) var(--space-2);
  }

  .view-playlist a {
    color: var(--color-fg);
  }

  .view-playlist span {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }
</style>
