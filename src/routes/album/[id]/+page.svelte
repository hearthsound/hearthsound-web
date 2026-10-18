<!--
  An album.

  The page shows the album's cover, its artist and year, its availability
  badge, the control that saves it to the personal library, and its tracks in
  order. Playing a track plays the album from there on, and a track that is not
  on the server goes through the acquisition flow like any other.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import CoverArt from '#lib/components/CoverArt.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import SaveButton from '#lib/library/SaveButton.svelte';
  import { availabilityLabel } from '#lib/labels';
  import { membership } from '#lib/library/membership.svelte';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { availability } from '#lib/stores/availability.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { AlbumWithSongs, Child } from '#lib/subsonic/types';

  const id = $derived(page.params.id ?? '');

  let album = $state<AlbumWithSongs | null>(null);
  let failure = $state<string | null>(null);
  let loading = $state(true);

  let generation = 0;

  const albumState = $derived(album === null ? null : availability.of(album));

  $effect(() => {
    const current = id;
    const mine = ++generation;
    untrack(() => void load(current, mine));
  });

  /**
   * Reads the album and remembers what its entities report.
   *
   * @param current The album's client id.
   * @param mine The generation of this read.
   */
  async function load(current: string, mine: number): Promise<void> {
    loading = true;
    failure = null;
    try {
      const answer = await libraryApi.album(current);
      if (mine !== generation) {
        return;
      }
      album = answer;
      if (answer !== null) {
        availability.remember([answer, ...(answer.song ?? [])]);
        membership.remember([answer]);
      }
    } catch (error) {
      if (mine === generation) {
        failure = error instanceof Error ? error.message : 'The album could not be read.';
        album = null;
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  /**
   * Plays one of the album's tracks, with the album as the queue.
   *
   * @param song The track to play.
   */
  function play(song: Child): void {
    const tracks = album?.song ?? [];
    const index = tracks.findIndex((entry) => entry.id === song.id);
    player.play(tracks.map(queueItemOf), index < 0 ? 0 : index);
  }
</script>

<svelte:head>
  <title>{album?.name ?? 'Album'} - Hearthsound</title>
</svelte:head>

<section>
  {#if failure !== null}
    <p class="album-failure" role="alert">{failure}</p>
  {:else if loading && album === null}
    <p class="album-hint">Loading...</p>
  {:else if album === null}
    <p class="album-hint">There is no such album.</p>
  {:else}
    <header class="album-header">
      <CoverArt coverArt={album.coverArt} size={192} alt="" />
      <div class="album-details">
        <h1>{album.name}</h1>
        <p class="album-artist">{album.artist ?? ''}</p>
        <p class="album-meta">
          {#if album.year !== undefined}{album.year}{/if}
          {#if album.songCount !== undefined}
            {album.songCount} tracks{/if}
        </p>
        {#if albumState !== null}
          <p class="album-badge">{availabilityLabel(albumState)}</p>
        {/if}
        <SaveButton entity={album} />
      </div>
    </header>

    <ul class="album-songs">
      {#each album.song ?? [] as song (song.id)}
        <SongRow {song} {play} />
      {/each}
    </ul>
  {/if}
</section>

<style>
  .album-header {
    display: flex;
    gap: var(--space-4);
    align-items: flex-start;
    margin-bottom: var(--space-4);
  }

  .album-details {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    align-items: flex-start;
  }

  .album-details h1 {
    margin: 0;
  }

  .album-artist,
  .album-meta,
  .album-badge,
  .album-hint,
  .album-failure {
    margin: 0;
    color: var(--color-fg-muted);
  }

  .album-failure {
    color: var(--color-danger);
  }

  .album-songs {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
