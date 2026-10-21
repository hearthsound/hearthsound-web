<!--
  A Home shelf (l13).

  One sideways-scrolling row of cards under a k33 section header. On desktop
  the header's flat arrow buttons scroll one page of cards, named "Scroll
  Left" and "Scroll Right"; on phones the row swipes and the package hides the
  buttons. The buttons appear only while the row overflows, and the one whose
  end has been reached is disabled, so Tab never lands on a dead control.

  The scrollport keeps the 8 px the cards draw their hover tile in, so a
  hovering card is never clipped and the cards stay on the page margin.

  Usage:
  `<Shelf title="Recently Added" href="/home/recently-added">
     {#each albums as album (album.id)}<AlbumCard {album} />{/each}
   </Shelf>`
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';
  import SectionHeader from './SectionHeader.svelte';
  import { shelfEdges } from './shelf';
  import type { ShelfEdges } from './shelf';

  /** Props of the shelf. */
  interface Props {
    /** The shelf's title and the name of its full-list link. */
    title: string;
    /** The shelf's full-list page. */
    href?: string;
    /** Whether the shelf's section header already sits on the page margin. */
    flush?: boolean;
    /** The cards. */
    children: Snippet;
  }

  let { title, href, flush = false, children }: Props = $props();

  let row = $state<HTMLDivElement>();

  /** Which buttons the row shows and which ends it has reached. */
  let edges = $state<ShelfEdges>({ overflow: false, back: false, forward: false });

  /** Reads the row's scroll box into the buttons' state. */
  function measure(): void {
    if (row === undefined) {
      return;
    }
    edges = shelfEdges(row.scrollLeft, row.scrollWidth, row.clientWidth);
  }

  // The cards and the window both change the box: cards arriving from a read,
  // cards leaving after an unlike, and the row resizing with the window.
  $effect(() => {
    const node = row;
    if (node === undefined) {
      return;
    }
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(node);
    const changes = new MutationObserver(measure);
    changes.observe(node, { childList: true, subtree: true });
    return () => {
      resize.disconnect();
      changes.disconnect();
    };
  });

  /**
   * Scrolls the row by one visible page.
   *
   * @param direction -1 scrolls left, 1 scrolls right.
   */
  function scroll(direction: -1 | 1): void {
    if (row === undefined) {
      return;
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    row.scrollBy({
      left: direction * row.clientWidth,
      behavior: reduce ? 'auto' : 'smooth'
    });
  }
</script>

<section class="hs-home-section" class:hs-home-section--flush={flush} aria-label={title}>
  <SectionHeader {title} {href}>
    {#snippet actions()}
      {#if edges.overflow}
        <button
          class="hs-button hs-button--flat hs-button--icon hs-shelf__button"
          type="button"
          aria-label="Scroll Left"
          disabled={!edges.back}
          onclick={() => scroll(-1)}
        >
          <Icon name="adwaita-back" class="hs-button__icon" />
        </button>
        <button
          class="hs-button hs-button--flat hs-button--icon hs-shelf__button"
          type="button"
          aria-label="Scroll Right"
          disabled={!edges.forward}
          onclick={() => scroll(1)}
        >
          <Icon name="adwaita-forward" class="hs-button__icon" />
        </button>
      {/if}
    {/snippet}
  </SectionHeader>

  <div class="hs-shelf" class:hs-shelf--flush={flush} bind:this={row} onscroll={measure}>
    {@render children()}
  </div>
</section>
