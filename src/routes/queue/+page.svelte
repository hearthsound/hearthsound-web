<!--
  The queue.

  Every item shows what the server is doing about it: whether it is ready, how
  far its prefetch has come, or that nothing is prefetching it. Clicking an item
  plays it, and the controls beside it reorder or drop it without interrupting
  the track that plays.
-->
<script lang="ts">
  import CoverArt from '#lib/components/CoverArt.svelte';
  import { formatDuration } from '#lib/format';
  import { prefetchLabel } from '#lib/labels';
  import { player } from '#lib/player/player.svelte';
</script>

<svelte:head>
  <title>Queue - Hearthsound</title>
</svelte:head>

<section>
  <h1>Queue</h1>

  {#if player.queue.items.length === 0}
    <p>Nothing is queued.</p>
  {:else}
    <ol class="queue">
      {#each player.queue.items as item, index (item.id)}
        {@const state = player.prefetch.stateFor(item.id)}
        <li class="queue-item" class:queue-current={index === player.queue.currentIndex}>
          <CoverArt coverArt={item.coverArt} size={40} alt="" />

          <button
            class="queue-play"
            type="button"
            onclick={() => player.play(player.queue.items, index)}
          >
            {item.title}
          </button>

          <span class="queue-artist">{item.artist ?? ''}</span>
          <span class="queue-duration">{formatDuration(item.durationSecs)}</span>

          <span class="queue-state" role="status">
            {prefetchLabel({
              availability: state.availability,
              state: state.state,
              percent: state.percent,
              prefetch: state.prefetch
            })}
          </span>

          <span class="queue-controls">
            <button
              type="button"
              disabled={index === 0}
              onclick={() => player.move(index, index - 1)}
            >
              Up
            </button>
            <button
              type="button"
              disabled={index === player.queue.items.length - 1}
              onclick={() => player.move(index, index + 1)}
            >
              Down
            </button>
            <button type="button" onclick={() => player.remove(index)}>Remove</button>
          </span>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .queue {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .queue-item {
    display: flex;
    gap: var(--space-3);
    align-items: center;
    padding: var(--space-2);
    border: var(--border-width) solid transparent;
    border-radius: var(--radius);
  }

  .queue-current {
    background: var(--color-bg-raised);
    border-color: var(--color-border);
  }

  .queue-play {
    flex: 1 1 10rem;
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

  .queue-play:hover {
    color: var(--color-accent);
  }

  .queue-artist,
  .queue-duration,
  .queue-state {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .queue-controls {
    display: flex;
    gap: var(--space-1);
  }

  .queue-controls button {
    padding: var(--space-1) var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .queue-controls button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
