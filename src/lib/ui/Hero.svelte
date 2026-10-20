<!--
  The detail hero (l09, p15, p16-r1, p17).

  A large artwork beside the title, an optional bold by-line, muted meta lines,
  a biography clamped to three lines with Show more / Show less in place, and
  the caller's action buttons. The round variant draws an artist portrait.

  Usage:
  ```
  <Hero
    title="Blue Train"
    by="John Coltrane"
    meta={['1957 - 5 songs - 42 min']}
    art={coverUrl}
    actions={actionsSnippet}
  />
  ```
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Props of the hero. */
  interface Props {
    /** The page title; the hero's `h1`. */
    title: string;
    /** The artwork URL; the placeholder tone shows while it is absent. */
    art?: string | null;
    /** The artwork as markup, for a playlist mosaic or a caller's cover component. */
    artwork?: Snippet;
    /** The artwork's alternative text; empty when the title beside it names it. */
    artAlt?: string;
    /** Draws the artwork as the round artist portrait (f15c). */
    round?: boolean;
    /** A bold line under the title, such as the album's artist. */
    by?: string;
    /** The muted detail lines under the by-line. */
    meta?: string[];
    /** The biography, clamped to three lines with a disclosure. */
    bio?: string;
    /** The Play, Shuffle, like and menu buttons. */
    actions?: Snippet;
  }

  let {
    title,
    art = null,
    artwork,
    artAlt = '',
    round = false,
    by,
    meta = [],
    bio,
    actions
  }: Props = $props();

  const bioId = $props.id();
</script>

<section class="hs-hero">
  <div class="hs-hero__art" class:hs-hero__art--round={round}>
    {#if artwork}
      {@render artwork()}
    {:else if art !== null && art !== ''}
      <img src={art} alt={artAlt} />
    {/if}
  </div>

  <div class="hs-hero__text">
    <h1>{title}</h1>

    {#if by !== undefined}
      <p class="hs-hero__by">{by}</p>
    {/if}

    {#each meta as line, index (index)}
      <p class="hs-hero__meta">{line}</p>
    {/each}

    {#if bio !== undefined && bio !== ''}
      <div class="hs-hero__bio">
        <input class="hs-hero__bio-toggle hs-visually-hidden" type="checkbox" id={bioId} />
        <p>{bio}</p>
        <label class="hs-hero__more hs-link" for={bioId}>
          <span class="hs-hero__more-closed">Show more</span>
          <span class="hs-hero__more-open">Show less</span>
        </label>
      </div>
    {/if}

    {#if actions}
      <div class="hs-hero__actions">{@render actions()}</div>
    {/if}
  </div>
</section>
