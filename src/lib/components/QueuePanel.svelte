<!--
  The queue panel of the now-playing view (p19-r1, p19b).

  One row per queued track: the played rows dim, the playing row marks itself
  current and shows the equaliser, and an upcoming row carries the k10 pill of
  what the scheduler is doing with it. A press anywhere in a row plays that
  row, on the text and the artwork alike (row-click).
-->
<script lang="ts">
  import CoverArt from '#lib/components/CoverArt.svelte';
  import { formatDuration } from '#lib/format';
  import { prefetchPill } from '#lib/player/fetch';
  import { player } from '#lib/player/player.svelte';
  import type { QueueItem } from '#lib/player/queue.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Pill from '#lib/ui/Pill.svelte';

  /**
   * Plays one row of the queue from the start.
   *
   * @param index The row's position in the queue.
   */
  function playRow(index: number): void {
    player.play(player.queue.items, index);
  }

  /**
   * Returns a row's accessible name: its title, artist and length.
   *
   * @param item The row's track.
   * @returns The name, with the empty parts left out.
   */
  function rowName(item: QueueItem): string {
    return [item.title, item.artist ?? '', formatDuration(item.durationSecs)]
      .filter((part) => part !== '')
      .join(', ');
  }
</script>

<div class="hs-now-playing__panel">
  <ul class="hs-track-list">
    {#each player.queue.items as item, index (index)}
      {@const isCurrent = index === player.queue.currentIndex}
      {@const isPlayed = index < player.queue.currentIndex}
      {@const isUpcoming = index > player.queue.currentIndex}
      {@const rowPill = isUpcoming ? prefetchPill(player.prefetch.stateFor(item.id)) : null}
      <li
        class="hs-track-row hs-track-row--queue"
        class:hs-track-row--current={isCurrent}
        class:hs-track-row--played={isPlayed}
        aria-current={isCurrent ? 'true' : undefined}
      >
        <button
          class="hs-track-row__open"
          type="button"
          aria-label={rowName(item)}
          onclick={() => playRow(index)}
        ></button>
        <span class="hs-track-row__lead">
          <CoverArt
            coverArt={item.coverArt}
            icon="adwaita-song"
            size={80}
            class="hs-track-row__art"
          />
          <span class="hs-track-row__overlay">
            {#if isCurrent}
              <span class="hs-eq" class:hs-eq--paused={!player.playing}>
                <i></i><i></i><i></i>
              </span>
            {:else}
              <Icon name="adwaita-play" />
            {/if}
          </span>
        </span>

        <span class="hs-track-row__text">
          <span class="hs-track-row__title">{item.title}</span>
          <span class="hs-track-row__artist">{item.artist ?? ''}</span>
        </span>

        <span class="hs-now-playing__queue-end">
          {#if rowPill !== null}
            <Pill tone={rowPill.tone} glyph={rowPill.glyph} label={rowPill.label} />
          {/if}
          <span class="hs-track-row__duration">{formatDuration(item.durationSecs)}</span>
        </span>
      </li>
    {/each}
  </ul>
</div>

<style>
  /* Layout glue only: the queue list starts on the panel's own edge so its
     artwork lines up with the Lyrics | Queue switch above it, and the row's
     covering play target needs its own box. */
  .hs-now-playing__panel .hs-track-list {
    margin: 0;
    padding: 0;
  }

  .hs-now-playing__panel .hs-track-row--queue {
    padding-left: 0;
  }

  /* The press target covers the whole row; the cells let the press through, so
     the text and the artwork do not swallow it (row-click). */
  .hs-track-row__open {
    position: absolute;
    inset: 0;
    z-index: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .hs-track-row__lead,
  .hs-track-row__text,
  .hs-now-playing__queue-end {
    pointer-events: none;
  }

  .hs-track-row__lead {
    position: relative;
  }

  /* The package hides every track row's duration on phones; the queue end cell
     keeps it so the prefetch pill stacks above it (p19). */
  @media (max-width: 720px) {
    .hs-now-playing__queue-end .hs-track-row__duration {
      display: block;
    }
  }
</style>
