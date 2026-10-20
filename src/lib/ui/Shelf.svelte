<!--
  A Home shelf (l13).

  One sideways-scrolling row of cards under a k33 section header. On desktop
  the header's flat arrow buttons scroll one page of cards, named "Scroll
  Left" and "Scroll Right"; on phones the row swipes and the package hides the
  buttons.

  Usage:
  `<Shelf title="Recently Added" href="/home/recently-added">
     {#each albums as album (album.id)}<AlbumCard {album} />{/each}
   </Shelf>`
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';
  import SectionHeader from './SectionHeader.svelte';

  /** Props of the shelf. */
  interface Props {
    /** The shelf's title and the name of its full-list link. */
    title: string;
    /** The shelf's full-list page. */
    href?: string;
    /** The cards. */
    children: Snippet;
  }

  let { title, href, children }: Props = $props();

  let row = $state<HTMLDivElement>();

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

<section class="hs-home-section" aria-label={title}>
  <SectionHeader {title} {href}>
    {#snippet actions()}
      <button
        class="hs-button hs-button--flat hs-button--icon hs-shelf__button"
        type="button"
        aria-label="Scroll Left"
        onclick={() => scroll(-1)}
      >
        <Icon name="adwaita-back" class="hs-button__icon" />
      </button>
      <button
        class="hs-button hs-button--flat hs-button--icon hs-shelf__button"
        type="button"
        aria-label="Scroll Right"
        onclick={() => scroll(1)}
      >
        <Icon name="adwaita-forward" class="hs-button__icon" />
      </button>
    {/snippet}
  </SectionHeader>

  <div class="hs-shelf" bind:this={row}>
    {@render children()}
  </div>
</section>
