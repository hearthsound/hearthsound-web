<!--
  The detail hero (l09, p15, p16-r1, p17).

  A large artwork beside the title, an optional bold by-line, muted meta lines,
  a biography clamped to three lines with a Show more that opens the whole text
  in a dialog, and the caller's action buttons. The round variant draws an
  artist portrait.

  The biography never grows the hero: expanding it in place pushed the portrait
  down and moved everything under it, so the clamp stays and Show more opens a
  640 px dialog instead. The command is drawn only when the text really has
  more lines than the clamp shows, which the paragraph reports about itself.

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
  import type { Snippet } from 'svelte';
  import { routeHref } from '#lib/navigation';

  import Button from './Button.svelte';
  import Dialog from './Dialog.svelte';

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
    /** The biography, clamped to three lines with Show more opening it in a dialog. */
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

  /** The clamped biography paragraph, measured for whether it overflows. */
  let bioText = $state<HTMLParagraphElement | undefined>();
  /** Whether the clamped biography has more lines than the hero may show. */
  let bioClamped = $state(false);
  /** Whether the full biography is open over the page. */
  let bioOpen = $state(false);

  $effect(() => {
    const element = bioText;
    if (element === undefined) {
      return;
    }
    if (bio === undefined || bio === '') {
      bioClamped = false;
      return;
    }
    const measure = (): void => {
      bioClamped = element.scrollHeight > element.clientHeight + 1;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  });
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
          <a class="hs-hero__by-link" href={routeHref(byHref)} data-entity-id={byTargetId}>{by}</a>
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
        <p bind:this={bioText}>{bio}</p>
        {#if bioClamped}
          <button class="hs-hero__more hs-link" type="button" onclick={() => (bioOpen = true)}>
            Show more
          </button>
        {/if}
      </div>
    {/if}

    {#if actions}
      <div class="hs-hero__actions">{@render actions()}</div>
    {/if}
  </div>
</section>

{#if bioOpen && bio !== undefined}
  <Dialog title={`About ${title}`} wide onclose={() => (bioOpen = false)}>
    <!-- Focus starts on the text, so a long biography opens at its first line
         instead of scrolled down to the Close command. -->
    <p tabindex="-1" data-autofocus>{bio}</p>
    {#snippet footer()}
      <Button onclick={() => (bioOpen = false)}>Close</Button>
    {/snippet}
  </Dialog>
{/if}
