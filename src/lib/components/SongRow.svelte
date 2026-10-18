<!--
  A song row.

  A row shows the track, its availability badge and - while the client is
  acquiring it - the progress of that acquisition. The badge follows the
  availability events, so a track that becomes playable while the list is on
  screen stops saying it is not on the server.
-->
<script lang="ts">
  import CoverArt from '#lib/components/CoverArt.svelte';
  import { formatDuration } from '#lib/format';
  import { availabilityLabel } from '#lib/labels';
  import { player } from '#lib/player/player.svelte';
  import { availability } from '#lib/stores/availability.svelte';
  import type { Child } from '#lib/subsonic/types';

  /** Props of a song row. */
  interface Props {
    /** The track to show. */
    song: Child;
    /**
     * Called when the track is played.
     *
     * @param song The track to play.
     */
    play: (song: Child) => void;
  }

  let { song, play }: Props = $props();

  const state = $derived(availability.of(song));
  const badge = $derived(state === null ? null : availabilityLabel(state));
  const progress = $derived(player.acquiringId === song.id ? player.progress : null);
</script>

<li class="song-row" class:song-current={player.queue.current?.id === song.id}>
  <CoverArt coverArt={song.coverArt} size={40} alt="" />

  <button class="song-play" type="button" onclick={() => play(song)}>
    {song.title ?? song.name ?? ''}
  </button>

  <span class="song-artist">{song.artist ?? ''}</span>
  <span class="song-album">{song.album ?? ''}</span>
  <span class="song-duration">{formatDuration(song.duration)}</span>

  {#if progress !== null}
    <span class="song-progress" role="status">{progress}</span>
  {:else if badge !== null}
    <span class="song-badge">{badge}</span>
  {/if}
</li>

<style>
  .song-row {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-1) var(--space-2);
    border: var(--border-width) solid transparent;
    border-radius: var(--radius);
  }

  .song-current {
    background: var(--color-bg-raised);
    border-color: var(--color-border);
  }

  .song-play {
    flex: 1 1 12rem;
    overflow: hidden;
    color: var(--color-fg);
    font: inherit;
    text-align: left;
    white-space: nowrap;
    text-overflow: ellipsis;
    background: none;
    border: none;
    cursor: pointer;
  }

  .song-play:hover {
    color: var(--color-accent);
  }

  .song-artist,
  .song-album {
    flex: 0 1 10rem;
    overflow: hidden;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .song-duration,
  .song-badge,
  .song-progress {
    flex: none;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .song-badge,
  .song-progress {
    padding: 0 var(--space-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }
</style>
