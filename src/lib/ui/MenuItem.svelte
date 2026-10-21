<!--
  One command in a Menu.

  A plain item reports the choice with `onselect` and closes the menu. An item
  that receives a `submenu` snippet instead opens that list beside itself with
  Right, with Left or Escape returning; on a phone the list replaces the menu
  and carries a header row with a Back command (k18).

  Usage:
  `<MenuItem label="Add to Queue" icon="adwaita-queue" onselect={queue} />`
  or
  `<MenuItem label="Add to Playlist" icon="adwaita-playlist" submenuLabel="Add to Playlist">
     {#snippet submenu()}<MenuItem label="New Playlist" ... />{/snippet}
   </MenuItem>`
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';
  import { tick } from 'svelte';
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';
  import { getMenuContext } from './menu-context';

  /** Props of a menu item. */
  interface Props {
    /** The visible label and, without a submenu label, the item's accessible name. */
    label: string;
    /** The leading sprite icon. */
    icon?: IconName;
    /** Whether the item is shown but cannot be chosen. */
    disabled?: boolean;
    /** Draws the item in the destructive tone, for a delete command. */
    destructive?: boolean;
    /** The accessible name of the submenu; the item's label when not given. */
    submenuLabel?: string;
    /** Content before the label, e.g. a small mosaic cover. */
    leading?: Snippet;
    /** The submenu's items; their presence makes this item a submenu trigger. */
    submenu?: Snippet;
    /** Runs when the item is chosen. */
    onselect?: () => void;
  }

  let {
    label,
    icon,
    disabled = false,
    destructive = false,
    submenuLabel,
    leading,
    submenu,
    onselect
  }: Props = $props();

  const menu = getMenuContext();
  const id = $props.id();
  let item = $state<HTMLElement>();
  let open = $state(false);

  const isPhone = $derived(menu?.phone() ?? false);
  const expanded = $derived(
    submenu === undefined ? undefined : isPhone ? menu?.submenu()?.token === id : open
  );

  /**
   * Opens or closes the submenu, or reports a plain choice and closes the menu.
   *
   * @param event The click or key press on the item.
   */
  function activate(event: Event): void {
    // A click inside the item's own cascading submenu belongs to that submenu,
    // not to the item that opened it. Clicks on the item's label and leading
    // cover are the item's own.
    const nested = item?.querySelector(':scope > .hs-submenu');
    if (
      nested !== undefined &&
      nested !== null &&
      event.target instanceof Node &&
      nested.contains(event.target)
    ) {
      return;
    }
    if (disabled) {
      event.preventDefault();
      return;
    }
    if (submenu === undefined) {
      onselect?.();
      menu?.close(true);
      return;
    }
    event.preventDefault();
    if (isPhone) {
      if (menu?.submenu()?.token === id) {
        menu.closeSubmenu();
        return;
      }
      menu?.openSubmenu(id, submenuLabel ?? label, submenu);
      return;
    }
    open = !open;
    if (open) {
      void tick().then(() => {
        item?.querySelector<HTMLElement>('.hs-submenu .hs-menu__item')?.focus();
      });
    } else {
      item?.focus();
    }
  }
</script>

{#if submenu === undefined}
  <button
    class="hs-menu__item"
    class:hs-menu__item--destructive={destructive}
    type="button"
    role="menuitem"
    tabindex="-1"
    aria-disabled={disabled || undefined}
    onclick={activate}
  >
    {#if icon !== undefined}
      <Icon name={icon} />
    {/if}
    {#if leading !== undefined}
      {@render leading()}
    {/if}
    <span class="hs-menu__label">{label}</span>
  </button>
{:else}
  <div
    class="hs-menu__item"
    role="menuitem"
    tabindex="-1"
    data-menu-item={id}
    aria-disabled={disabled || undefined}
    aria-haspopup="menu"
    aria-expanded={expanded}
    bind:this={item}
    onclick={activate}
    onkeydown={(event) => {
      if (event.target !== event.currentTarget) {
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        event.stopPropagation();
        activate(event);
      }
    }}
  >
    {#if icon !== undefined}
      <Icon name={icon} />
    {/if}
    {#if leading !== undefined}
      {@render leading()}
    {/if}
    <span class="hs-menu__label">{label}</span>
    <Icon name="adwaita-forward" />
    {#if open && !isPhone}
      <div class="hs-submenu" role="menu" aria-label={submenuLabel ?? label}>
        {@render submenu()}
      </div>
    {/if}
  </div>
{/if}
