<!--
  One area card on the admin Overview (l10).

  The whole card is the link, named "Open <Area>"; its header holds the area
  icon, the visible area name and the decorative forward chevron. The body is
  a key number or a state pill, with the c04 value line under it. A page that
  needs a progress bar passes it as content between the number and the line.

  The name is wrapped in `hs-admin-card__title` so a card without a link has no
  trailing icon: the package pushes `header .hs-icon:last-child` to the right,
  which would otherwise shove the icon and the name to the card's edge.

  Usage:
  `<OverviewCard area="Users" icon="adwaita-users" href="/admin/users" value="3"
    line="3 administrators" />`
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import { routeHref } from '#lib/navigation';
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';

  /** Props of the card. */
  interface Props {
    /** The visible area name, from the l10 list. */
    area: string;
    /** The sprite icon of the area. */
    icon: IconName;
    /** The area's page; a card without one draws no link. */
    href?: string;
    /** The key number, when the card shows one. */
    value?: string;
    /** The c04 value line under the number or pill. */
    line?: string;
    /** A state pill, progress bar or other body in place of a key number. */
    children?: Snippet;
  }

  let { area, icon, href, value, line, children }: Props = $props();
</script>

{#snippet body()}
  <span class="hs-admin-card__header">
    <Icon name={icon} />
    <span class="hs-admin-card__title">{area}</span>
    {#if href !== undefined}
      <Icon name="adwaita-forward" />
    {/if}
  </span>
  {#if value !== undefined}
    <span class="hs-admin-card__number">{value}</span>
  {/if}
  {@render children?.()}
  {#if line !== undefined}
    <span class="hs-admin-card__line">{line}</span>
  {/if}
{/snippet}

{#if href === undefined}
  <div class="hs-admin-card">{@render body()}</div>
{:else}
  <a class="hs-admin-card" href={routeHref(href)} aria-label="Open {area}">{@render body()}</a>
{/if}
