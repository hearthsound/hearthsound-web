<!--
  Card placeholders (k09b inside a k34 list).

  The placeholder cards are grid items of the card grid that holds the real
  cards, so they flow into the free cells of its last row instead of starting a
  new grid of their own. Their number covers exactly that free space: the cards
  already in the grid decide how many cells are left, and the grid's own column
  count is read from it. A grid without cards shows whole rows instead, which
  `rows` sets.

  Usage:
  `<div class="hs-card-grid" bind:this={grid}>
     {#each albums as album (album.id)}<AlbumCard {album} />{/each}
     {#if loading}<CardPlaceholders items={albums.length} {grid} />{/if}
   </div>`
-->
<script lang="ts">
  import Skeleton from './Skeleton.svelte';

  /** Props of the placeholders. */
  interface Props {
    /** How many real cards the grid already holds. */
    items: number;
    /** The grid the placeholders lay out in. */
    grid: HTMLElement | undefined;
    /** Draws the k14 artist shape: a round cover and no second line. */
    artist?: boolean;
    /** How many whole rows to cover while the grid is still empty. */
    rows?: number;
  }

  let { items, grid, artist = false, rows = 1 }: Props = $props();

  /** The grid's column count, read from its layout. */
  let columns = $state(1);

  $effect(() => {
    const node = grid;
    if (node === undefined) {
      return;
    }
    const measure = (): void => {
      const template = getComputedStyle(node).gridTemplateColumns;
      columns = template === 'none' ? 1 : template.split(' ').filter(Boolean).length;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  });

  /** The cells the next page has to fill: the last row's gap, or whole rows. */
  const count = $derived(items === 0 ? columns * rows : columns - (items % columns));
</script>

{#each Array.from({ length: count }, (_, index) => index) as key (key)}
  <div class="hs-card" class:hs-card--artist={artist} aria-hidden="true">
    <span class="hs-card__cover">
      <Skeleton width="100%" height="100%" radius={artist ? 'full' : 'art'} />
    </span>
    <span class="hs-card__text">
      <Skeleton width="80%" height="14px" />
      {#if !artist}
        <Skeleton width="50%" height="13px" />
      {/if}
    </span>
  </div>
{/each}
