<!--
  The detail hero (l09, p15, p16-r1, p17).

  A large artwork beside the title, an optional bold by-line, muted meta lines,
  a biography clamped to three lines with Show more / Show less in place, and
  the caller's action buttons. The round variant draws an artist portrait.

  The by-line is a link when the caller names one, so the album hero's artist
  opens its page; the id travels with the link so the page opens by id instead
  of resolving the path again. A caller may also pass markup under the title,
  which is where a generated playlist states its origin and refresh cadence.

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
  import { resolve } from '$app/paths';
  import type { Snippet } from 'svelte';
  import { clientRoute } from '#lib/navigation';

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
    /** The page the by-line names; the line stays text when it is absent. */
    byHref?: string;
    /** The entity the by-line names, remembered when its link is pressed. */
    byTargetId?: string;
    /** Extra markup under the title, such as the generated-playlist marker. */
    note?: Snippet;
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
    byHref,
    byTargetId,
    note,
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
      <p class="hs-hero__by">
        {#if byHref !== undefined}
          <a
            class="hs-hero__by-link"
            href={resolve(clientRoute(byHref))}
            data-entity-id={byTargetId}>{by}</a
          >
        {:else}
          {by}
        {/if}
      </p>
    {/if}

    {#if note}
      {@render note()}
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
