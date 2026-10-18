<!--
  The player bar.

  It shows the track that plays, its position, the controls, and - while the
  track is still being acquired - the progress label the player is reporting.
-->
<script lang="ts">
  import CoverArt from '#lib/components/CoverArt.svelte';
  import { formatDuration } from '#lib/format';
  import { player } from '#lib/player/player.svelte';

  const current = $derived(player.queue.current);
  const position = $derived(
    Number.isFinite(player.durationSecs) && player.durationSecs > 0
      ? Math.min(player.positionSecs, player.durationSecs)
      : 0
  );

  /**
   * Moves playback to the position the seek bar was dragged to.
   *
   * @param event The input event.
   */
  function seek(event: Event): void {
    player.seek(Number((event.currentTarget as HTMLInputElement).value));
  }
</script>

{#if current !== null}
  <div class="player-bar">
    <CoverArt coverArt={current.coverArt} size={48} alt="" />

    <div class="player-track">
      <p class="player-title">{current.title}</p>
      {#if current.artist !== null && current.artist !== undefined && current.artist !== ''}
        <p class="player-artist">{current.artist}</p>
      {/if}
      {#if player.progress !== null}
        <p class="player-progress" role="status">{player.progress}</p>
      {/if}
    </div>

    <div class="player-controls">
      <button type="button" onclick={() => player.previous()}>Previous</button>
      <button type="button" onclick={() => player.toggle()}>
        {player.playing ? 'Pause' : 'Play'}
      </button>
      <button type="button" onclick={() => player.next()}>Next</button>
    </div>

    <div class="player-position">
      <span>{formatDuration(player.positionSecs)}</span>
      <input
        class="player-seek"
        type="range"
        min="0"
        max={player.durationSecs > 0 ? player.durationSecs : 0}
        step="1"
        value={position}
        aria-label="Seek"
        oninput={seek}
      />
      <span>{formatDuration(player.durationSecs)}</span>
    </div>
  </div>
{/if}

<style>
  .player-bar {
    display: flex;
    gap: var(--space-4);
    align-items: center;
    height: 100%;
    padding: var(--space-2) var(--space-4);
  }

  .player-track {
    min-width: 0;
    flex: 1 1 12rem;
  }

  .player-title,
  .player-artist,
  .player-progress {
    margin: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  .player-artist,
  .player-progress {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .player-controls {
    display: flex;
    gap: var(--space-2);
  }

  .player-controls button {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .player-position {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .player-seek {
    width: 12rem;
  }
</style>
