<!--
  An artist's complete top songs list.

  The "Top Songs" header on the artist page opens this page: the artist's most
  popular tracks, up to 100, as rows in the no-album context with the album as
  their second line. It carries the back button, the heading "Top Songs by
  <Artist>" and the status page when the read fails. A row plays the list the
  page already holds. The `entity.updated` event for the artist reads the list
  again once the indexer stored more.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import SongRow from '#lib/components/SongRow.svelte';
  import { loadArtist, loadTopTracks, songOf } from '#lib/entities/api';
  import type { ArtistPage, TrackSummary } from '#lib/entities/api';
  import { membership } from '#lib/library/membership.svelte';
  import TrackRowPlaceholders from '#lib/library/TrackRowPlaceholders.svelte';
  import { goBack } from '#lib/navigation';
  import { artistHref } from '#lib/paths';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { availability } from '#lib/stores/availability.svelte';
  import { events } from '#lib/stores/events.svelte';
  import Button from '#lib/ui/Button.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import type { Song } from '#lib/library/song';

  /** How many tracks the full list asks for; the server caps the answer. */
  const TOP_SONGS_LIMIT = 100;

  /** The artist's client id, as the address spells it. */
  const artistId = $derived(page.params.id ?? '');

  let artist = $state<ArtistPage | null>(null);
  let tracks = $state<TrackSummary[]>([]);
  let loading = $state(true);
  let failure = $state<string | null>(null);

  let generation = 0;

  /** The rows the page draws. */
  const songs = $derived(tracks.map(songOf));
  const heading = $derived(artist === null ? 'Top Songs' : `Top Songs by ${artist.name}`);
  /**
   * The rows to draw while the list is pending.
   *
   * The artist's own album count sizes the shimmer: a hundred rows for an
   * artist with three songs would promise a page the reader will never see.
   */
  const placeholders = $derived(
    artist === null ? 0 : Math.min(TOP_SONGS_LIMIT, artist.albums.length * 3)
  );

  $effect(() => {
    const id = artistId;
    const mine = ++generation;
    untrack(() => void load(id, mine));
  });

  // The indexer stored more about this artist: read the list once more.
  $effect(() => {
    const id = artistId;
    if (id === '') {
      return;
    }
    return events.on('entity.updated', (event) => {
      if (event.data.kind !== 'artist' || event.data.id !== id) {
        return;
      }
      void reload(id, generation);
    });
  });

  /** Returns to the artist page. */
  function back(): void {
    goBack(artistHref(artistId));
  }

  /**
   * Reads the artist and its most popular tracks.
   *
   * @param id The artist's client id.
   * @param mine The generation of this read.
   */
  async function load(id: string, mine: number): Promise<void> {
    loading = true;
    failure = null;
    artist = null;
    tracks = [];
    try {
      const [page, top] = await Promise.all([loadArtist(id), loadTopTracks(id, TOP_SONGS_LIMIT)]);
      if (mine !== generation) {
        return;
      }
      artist = page;
      tracks = top;
      availability.remember(top);
      membership.remember(top);
    } catch {
      if (mine === generation) {
        failure = 'The server did not answer.';
        artist = null;
        tracks = [];
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  /**
   * Reads the list again once the indexer stored more.
   *
   * @param id The artist's client id.
   * @param mine The generation this read belongs to.
   */
  async function reload(id: string, mine: number): Promise<void> {
    let top: TrackSummary[];
    try {
      top = await loadTopTracks(id, TOP_SONGS_LIMIT);
    } catch {
      return;
    }
    if (mine !== generation) {
      return;
    }
    tracks = top;
    availability.remember(top);
    membership.remember(top);
  }

  /**
   * Plays one of the top songs, with the list the page holds as the queue.
   *
   * @param song The track to play.
   */
  function playSong(song: Song): void {
    const index = songs.findIndex((row) => row.id === song.id);
    if (songs.length > 0) {
      player.play(songs.map(queueItemOf), Math.max(0, index));
    }
  }
</script>

<svelte:head>
  <title>{heading} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load(artistId, ++generation)}>Retry</Button>
{/snippet}

<div class="top-songs-page">
  <PageHeader title={heading} onback={back} />

  {#if failure !== null}
    <div class="state">
      <StatusPage
        alert
        icon="adwaita-error"
        title="Could Not Load This Page"
        text="The server did not answer. Try again in a moment."
        action={retryAction}
      />
    </div>
  {:else if loading}
    <div class="loading" aria-busy="true">
      <span class="hs-visually-hidden" role="status">Loading...</span>
      <ul class="hs-track-list hs-track-list--no-album songs">
        <TrackRowPlaceholders count={placeholders} />
      </ul>
    </div>
  {:else if artist === null}
    <div class="state">
      <StatusPage
        icon="adwaita-artist"
        title="Artist Not Found"
        text="It may have been removed, or the link is wrong."
      />
    </div>
  {:else if songs.length === 0}
    <StatusPage
      inline
      icon="adwaita-song"
      title="No Songs Yet"
      text="This artist has no songs stored yet."
    />
  {:else}
    <ul class="hs-track-list hs-track-list--no-album songs">
      {#each songs as song (song.id)}
        <SongRow {song} context="no-album" second="album" play={playSong} libraryMark />
      {/each}
    </ul>
  {/if}
</div>

<style>
  .top-songs-page :global(.hs-page-header) {
    padding-inline: 0;
  }

  .songs {
    margin: 0;
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
