<!--
  A section header whose title is the link to the full list (k33).

  The visible title carries the "See all" name for assistive technology and
  ends with the muted forward arrow. Without `href` the header is static, used
  where the heading is not a link. Extra actions, such as a shelf's scroll
  buttons, follow the title.

  Usage:
  `<SectionHeader title="Recently Added" href="/home/recently-added" />`
  or
  `<SectionHeader title="Songs" level={2} />`
-->
<script lang="ts">
  import { resolve } from '$app/paths';

  import { clientRoute } from '#lib/navigation';
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';

  /** Props of the header. */
  interface Props {
    /** The visible title and the section named in "See all <section>". */
    title: string;
    /** The full-list page; the title is a link when present. */
    href?: string;
    /** The heading level, over the page's section. */
    level?: 2 | 3 | 4;
    /** Actions after the title, e.g. a shelf's scroll buttons. */
    actions?: Snippet;
  }

  let { title, href, level = 2, actions }: Props = $props();

  const tag = $derived(`h${level}`);
</script>

<div class="hs-section-header">
  <svelte:element this={tag} class="hs-section-header__title">
    {#if href !== undefined}
      <a class="hs-section-header__link" href={resolve(clientRoute(href))}>
        <span aria-hidden="true">{title}</span>
        <Icon name="adwaita-forward" class="hs-section-header__arrow" />
        <span class="hs-visually-hidden">See all {title}</span>
      </a>
    {:else}
      {title}
    {/if}
  </svelte:element>

  {#if actions !== undefined}
    {@render actions()}
  {/if}
</div>
