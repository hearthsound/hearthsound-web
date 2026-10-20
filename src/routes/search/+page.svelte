<!--
  Search.

  The query travels to `search3`, which answers with the local results first
  and the catalog results after them; the page renders that order and does not
  sort it again. Every entity the answer carries is remembered in the
  availability store, so the badges are right and a catalog result the user
  plays goes through the acquisition flow.
-->
<script lang="ts">
  import { page } from '$app/state';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { player } from '#lib/player/player.svelte';
  import { availability } from '#lib/stores/availability.svelte';
  import { subsonic } from '#lib/subsonic/client';
  import type { AlbumID3, ArtistID3, Child, Search3Response } from '#lib/subsonic/types';

  /** How many songs, albums and artists one search asks for. */
  const SONG_COUNT = 30;
  const ALBUM_COUNT = 12;
  const ARTIST_COUNT = 12;

  /** How long the page waits after the last keystroke before it searches. */
  const QUERY_DELAY_MS = 300;

  let query = $state(page.url.searchParams.get('q') ?? '');
  let songs = $state<Child[]>([]);
  let albums = $state<AlbumID3[]>([]);
  let artists = $state<ArtistID3[]>([]);
  let searched = $state(false);
  let failure = $state<string | null>(null);

  let generation = 0;

  // The sidebar search field drives this page through the address (l14); a
  // query typed here stays local until the search page is redesigned.
  $effect(() => {
    const asked = page.url.searchParams.get('q');
    if (page.url.pathname === '/search' && asked !== null) {
      query = asked;
    }
  });

  $effect(() => {
    const text = query.trim();
    const current = ++generation;
    if (text === '') {
      songs = [];
      albums = [];
      artists = [];
      searched = false;
      failure = null;
      return;
    }
    const timer = setTimeout(() => {
      void search(text, current);
    }, QUERY_DELAY_MS);
    return () => clearTimeout(timer);
  });

  /**
   * Runs one search and renders its answer, unless a newer one started.
   *
   * @param text The query to search for.
   * @param current The generation of this search.
   */
  async function search(text: string, current: number): Promise<void> {
    try {
      const answer = await subsonic.get<Search3Response>('search3', {
        query: text,
        songCount: SONG_COUNT,
        albumCount: ALBUM_COUNT,
        artistCount: ARTIST_COUNT
      });
      if (current !== generation) {
        return;
      }
      const result = answer.searchResult3 ?? {};
      songs = result.song ?? [];
      albums = result.album ?? [];
      artists = result.artist ?? [];
      availability.remember([...songs, ...albums, ...artists]);
      searched = true;
      failure = null;
    } catch (error) {
      if (current !== generation) {
        return;
      }
      songs = [];
      albums = [];
      artists = [];
      searched = true;
      failure = error instanceof Error ? error.message : 'The search could not be run.';
    }
  }

  /**
   * Plays one of the found tracks, with the rest of the results as the queue.
   *
   * @param song The track to play.
   */
  function play(song: Child): void {
    const index = songs.findIndex((entry) => entry.id === song.id);
    player.play(songs.map(queueItemOf), index < 0 ? 0 : index);
  }
</script>

<svelte:head>
  <title>Search - Hearthsound</title>
</svelte:head>

<section>
  <h1>Search</h1>

  <label class="search-field">
    <span>Search</span>
    <input type="search" bind:value={query} placeholder="Song, album or artist" />
  </label>

  {#if failure !== null}
    <p class="search-failure" role="alert">{failure}</p>
  {:else if query.trim() === ''}
    <p class="search-hint">Search the library and the catalogues it draws from.</p>
  {:else if searched && songs.length + albums.length + artists.length === 0}
    <p class="search-hint">Nothing matched.</p>
  {/if}

  {#if songs.length > 0}
    <h2>Songs</h2>
    <ul class="search-songs">
      {#each songs as song (song.id)}
        <SongRow {song} {play} />
      {/each}
    </ul>
  {/if}

  {#if albums.length > 0}
    <h2>Albums</h2>
    <div class="search-cards">
      {#each albums as album (album.id)}
        <AlbumCard {album} />
      {/each}
    </div>
  {/if}

  {#if artists.length > 0}
    <h2>Artists</h2>
    <div class="search-cards">
      {#each artists as artist (artist.id)}
        <ArtistCard {artist} />
      {/each}
    </div>
  {/if}
</section>

<style>
  .search-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    max-width: 24rem;
    margin-bottom: var(--space-4);
  }

  .search-field input {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .search-hint,
  .search-failure {
    color: var(--color-fg-muted);
  }

  .search-failure {
    color: var(--color-danger);
  }

  .search-songs {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .search-cards {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-4);
  }
</style>
