<!--
  One area card on the admin Overview (l10).

  The whole card is the link, named "Open <Area>"; its header holds the area
  icon, the visible area name and the decorative forward chevron. The body is
  a key number or a state pill, with the c04 value line under it. A page that
  needs a progress bar passes it as content between the number and the line.

  Usage:
  `<OverviewCard area="Users" icon="adwaita-users" href="/admin/users" value="3"
    line="3 administrators" />`
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';
  import { resolve } from '$app/paths';

  import { clientRoute } from '#lib/navigation';
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';

  /** Props of the card. */
  interface Props {
    /** The visible area name, from the l10 list. */
    area: string;
    /** The sprite icon of the area. */
    icon: IconName;
    /** The area's page. */
    href: string;
    /** The key number, when the card shows one. */
    value?: string;
    /** The c04 value line under the number or pill. */
    line?: string;
    /** A state pill, progress bar or other body in place of a key number. */
    children?: Snippet;
  }

  let { area, icon, href, value, line, children }: Props = $props();
</script>

<a class="hs-admin-card" href={resolve(clientRoute(href))} aria-label="Open {area}">
  <span class="hs-admin-card__header">
    <Icon name={icon} />
    {area}
    <Icon name="adwaita-forward" />
  </span>
  {#if value !== undefined}
    <span class="hs-admin-card__number">{value}</span>
  {/if}
  {@render children?.()}
  {#if line !== undefined}
    <span class="hs-admin-card__line">{line}</span>
  {/if}
</a>
