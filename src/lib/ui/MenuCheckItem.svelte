<!--
  A menu item that chooses one of several values (k05).

  The check at the end is visible only on the checked item. The item is a
  `menuitemradio`, so assistive technology reports the current choice.

  Usage: `<MenuCheckItem label="Recently Added" checked={sort === 'added'} onselect={...} />`
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import Icon from './Icon.svelte';
  import { getMenuContext } from './menu-context';

  /** Props of a check item. */
  interface Props {
    /** The visible label. */
    label: string;
    /** Whether this item is the current choice. */
    checked: boolean;
    /** A leading icon for menus that draw one on every item. */
    icon?: IconName;
    /** Whether the item is shown but cannot be chosen. */
    disabled?: boolean;
    /** Runs when the item is chosen. */
    onselect?: () => void;
  }

  let { label, checked, icon, disabled = false, onselect }: Props = $props();

  const menu = getMenuContext();

  /** Chooses the item and closes the menu. */
  function choose(): void {
    if (disabled) {
      return;
    }
    onselect?.();
    menu?.close(true);
  }
</script>

<button
  class="hs-menu__item"
  type="button"
  role="menuitemradio"
  tabindex="-1"
  aria-checked={checked}
  aria-disabled={disabled || undefined}
  onclick={choose}
>
  {#if icon !== undefined}
    <Icon name={icon} />
  {/if}
  <span class="hs-menu__label">{label}</span>
  <Icon name="adwaita-check" class="hs-menu__check" />
</button>
