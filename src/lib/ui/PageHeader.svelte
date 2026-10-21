<!--
  The page header (k25 A, l03, l01-r1).

  A sticky 72 px row on the view background: the page title as `h1`, flat icon
  actions at the right and, leading the row, the back button of a drill-down
  page or the phone drawer's "Open Navigation" button. A 1 px separator appears
  under it once the page scrolls. The title names the page and is the heading
  assistive technology reads first.

  Usage:
  ```
  <PageHeader title="Albums" scrolled={scrolled} actions={actionsSnippet} />
  ```
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';

  /** Props of the header. */
  interface Props {
    /** The page title; the header's `h1`. */
    title: string;
    /** Flat icon buttons at the right, such as the shelf's Scroll Left and Scroll Right. */
    actions?: Snippet;
    /** Shows the l03 back button; takes the phone drawer button's place. */
    onback?: () => void;
    /** Shows the phone drawer's "Open Navigation" button on a top-level page. */
    onnavigation?: () => void;
    /** Draws the separator that appears once the page is scrolled. */
    scrolled?: boolean;
    /** Extra classes, for a page that aligns the header to its content margins. */
    class?: string;
  }

  let {
    title,
    actions,
    onback,
    onnavigation,
    scrolled = false,
    class: extra = ''
  }: Props = $props();
</script>

<header class="hs-page-header {extra}" class:hs-page-header--scrolled={scrolled}>
  {#if onback !== undefined}
    <button
      class="hs-button hs-button--flat hs-button--icon hs-back"
      type="button"
      aria-label="Back"
      onclick={onback}
    >
      <Icon name="adwaita-back" />
    </button>
  {:else if onnavigation !== undefined}
    <button
      class="hs-button hs-button--flat hs-button--icon hs-page-header__menu"
      type="button"
      aria-label="Open Navigation"
      onclick={onnavigation}
    >
      <Icon name="adwaita-menu" />
    </button>
  {/if}

  <h1 class="hs-page-header__title">{title}</h1>

  {#if actions}
    <div class="hs-page-actions">{@render actions()}</div>
  {/if}
</header>
