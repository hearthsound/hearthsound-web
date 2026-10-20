<!--
  One sidebar navigation row (k24 B, l02b A).

  An icon and a label on the 36 px row; the current page carries
  `aria-current="page"` and the current tone. An optional count badge adds the
  visually hidden word "items" after the number. Up/Down movement between rows
  belongs to the navigation group the shell builds.

  Usage:
  ```
  <NavRow href="/library/albums" icon="adwaita-album" label="Albums" current={page === 'albums'} />
  ```
-->
<script lang="ts">
  import { resolve } from '$app/paths';
  import type { IconName } from '@hearthsound/design/icons';
  import type { HTMLAnchorAttributes } from 'svelte/elements';

  import { clientRoute } from '#lib/navigation';

  import Icon from './Icon.svelte';

  /** Props of the row. */
  interface Props extends Omit<HTMLAnchorAttributes, 'href'> {
    /** The route the row opens. */
    href: string;
    /** The row's label and accessible name. */
    label: string;
    /** The 16 px icon the row leads with. */
    icon: IconName;
    /** Marks the row as the page in view. */
    current?: boolean;
    /** The number in the trailing badge, when the row counts something. */
    count?: number;
  }

  let { href, label, icon, current = false, count, class: extra = '', ...rest }: Props = $props();
</script>

<a
  {...rest}
  href={resolve(clientRoute(href))}
  class="hs-nav-item {extra}"
  class:hs-nav-item--current={current}
  aria-current={current ? 'page' : undefined}
>
  <Icon name={icon} />
  <span>{label}</span>
  {#if count !== undefined}
    <span class="hs-count-badge">{count} <span class="hs-visually-hidden">items</span></span>
  {/if}
</a>
