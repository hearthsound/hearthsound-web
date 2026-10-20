<!--
  A popover menu anchored to its trigger.

  The trigger opens the menu below itself, or above it when the viewport has
  no room below; the menu takes focus on its first item. Up and Down move,
  Home and End jump, Escape closes, and a menu that holds a submenu opens it
  with Right and closes it with Left. On a phone the submenu replaces the menu
  with a header row that returns (k18). A click outside closes the menu.

  The menu items are passed as content; MenuItem, MenuCheckItem and
  MenuSeparator make up the usual contents.

  Usage:
  `<Menu label="More Actions" menuLabel="Song actions">
     <MenuItem label="Add to Queue" icon="adwaita-queue" onselect={queue} />
   </Menu>`
-->
<script lang="ts" module>
  /** The attributes the trigger receives from the menu. */
  export interface MenuTriggerProps {
    /** Opens or closes the menu. */
    onclick: (event: MouseEvent) => void;
    /** Tells assistive technology that the button opens a menu. */
    'aria-haspopup': 'menu';
    /** Whether the menu is open. */
    'aria-expanded': boolean;
  }
</script>

<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';
  import { onMount, tick } from 'svelte';
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';
  import type { MenuSubmenu } from './menu-context';
  import { setMenuContext } from './menu-context';

  /** Props of the menu. */
  interface Props {
    /** The accessible name of the default trigger. */
    label: string;
    /** The accessible name of the menu list; the trigger's name when not given. */
    menuLabel?: string;
    /** The sprite id of the default trigger's icon; `adwaita-more` when not given. */
    icon?: IconName;
    /** Whether the menu is open; bindable for a page that opens it itself. */
    open?: boolean;
    /** Which edge of the trigger the menu is aligned to. */
    align?: 'start' | 'end';
    /** A trigger of the page's own; receives the attributes the menu needs. */
    trigger?: Snippet<[MenuTriggerProps]>;
    /** Reports every open and close. */
    onopenchange?: (open: boolean) => void;
    /** The menu items. */
    children: Snippet;
  }

  let {
    label,
    menuLabel,
    icon = 'adwaita-more',
    open = $bindable(false),
    align = 'start',
    trigger,
    onopenchange = () => {},
    children
  }: Props = $props();

  /** The menu's own accessible name, which the trigger's name fills in when absent. */
  const name = $derived(menuLabel ?? label);

  let anchor = $state<HTMLDivElement>();
  let panel = $state<HTMLDivElement>();
  let placement = $state<'above' | 'below'>('below');
  let phone = $state(false);
  let submenu = $state<MenuSubmenu | null>(null);
  let lastTrigger: HTMLElement | null = null;

  onMount(() => {
    const narrow = window.matchMedia('(max-width: 720px)');
    phone = narrow.matches;
    const follow = (event: MediaQueryListEvent) => {
      phone = event.matches;
      if (!event.matches) {
        submenu = null;
      }
    };
    narrow.addEventListener('change', follow);
    return () => narrow.removeEventListener('change', follow);
  });

  /**
   * Returns the menu items of one menu level, skipping disabled items.
   *
   * @param level The menu element whose direct items are returned.
   * @returns The focusable items, in order.
   */
  function itemsOf(level: HTMLElement): HTMLElement[] {
    return Array.from(level.querySelectorAll<HTMLElement>(':scope > .hs-menu__item')).filter(
      (item) => item.getAttribute('aria-disabled') !== 'true'
    );
  }

  /** Focuses the first item of the level that is on screen. */
  function focusFirst(): void {
    if (panel === undefined) {
      return;
    }
    itemsOf(panel)[0]?.focus();
  }

  /** Places the menu below the trigger when it fits and above it otherwise. */
  function place(): void {
    if (panel === undefined || anchor === undefined) {
      return;
    }
    const triggerBox = anchor.getBoundingClientRect();
    const menuHeight = panel.offsetHeight;
    placement =
      triggerBox.bottom + menuHeight > window.innerHeight && triggerBox.top > menuHeight
        ? 'above'
        : 'below';
  }

  /**
   * Closes the menu.
   *
   * @param restoreFocus Whether focus returns to the trigger.
   */
  function close(restoreFocus = false): void {
    const wasOpen = open;
    submenu = null;
    open = false;
    if (wasOpen) {
      onopenchange(false);
    }
    if (restoreFocus) {
      const target = lastTrigger ?? anchor?.querySelector<HTMLElement>('button');
      void tick().then(() => target?.focus());
    }
  }

  /**
   * Opens the menu.
   *
   * @param source The trigger element that received the opening gesture.
   */
  function openMenu(source: HTMLElement | null): void {
    if (source !== null) {
      lastTrigger = source;
    }
    if (!open) {
      open = true;
      onopenchange(true);
    }
  }

  /**
   * Toggles the menu from its trigger.
   *
   * @param event The click on the trigger.
   */
  function toggle(event: MouseEvent): void {
    if (open) {
      close();
      return;
    }
    openMenu(event.currentTarget as HTMLElement);
  }

  /**
   * Opens the menu from the keyboard when the trigger has focus.
   *
   * @param event The key press inside the trigger wrapper.
   */
  function triggerKey(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' || open) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('[role="menu"]') !== null) {
      return;
    }
    event.preventDefault();
    openMenu(target);
  }

  /**
   * Moves focus within the current menu level.
   *
   * @param item The focused item.
   * @param step The number of items to move; negative moves up.
   */
  function move(item: HTMLElement, step: number): void {
    const level = item.closest<HTMLElement>('[role="menu"]');
    if (level === null) {
      return;
    }
    const items = itemsOf(level);
    const index = items.indexOf(item);
    if (index === -1) {
      return;
    }
    const next = (index + step + items.length) % items.length;
    items[next]?.focus();
  }

  /**
   * Returns from a desktop submenu to its item.
   *
   * @param item The focused item inside the submenu.
   */
  function leaveSubmenu(item: HTMLElement): void {
    const level = item.closest<HTMLElement>('.hs-submenu');
    const parent = level?.closest<HTMLElement>('.hs-menu__item');
    if (level === null || level === undefined || parent === null || parent === undefined) {
      return;
    }
    parent.click();
    parent.focus();
  }

  /**
   * Handles the menu's keyboard commands.
   *
   * @param event The key press on a menu item.
   */
  async function panelKey(event: KeyboardEvent): Promise<void> {
    const item = (event.target as HTMLElement).closest<HTMLElement>('.hs-menu__item');
    if (item === null) {
      return;
    }
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        move(item, 1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        move(item, -1);
        return;
      case 'Home':
      case 'End': {
        const level = item.closest<HTMLElement>('[role="menu"]');
        if (level === null) {
          return;
        }
        event.preventDefault();
        const items = itemsOf(level);
        (event.key === 'Home' ? items[0] : items[items.length - 1])?.focus();
        return;
      }
      case 'ArrowRight': {
        if (item.getAttribute('aria-haspopup') !== 'menu') {
          return;
        }
        event.preventDefault();
        if (item.getAttribute('aria-expanded') !== 'true') {
          item.click();
          await tick();
        }
        const first = phone
          ? panel?.querySelector<HTMLElement>(':scope > .hs-menu__item')
          : item.querySelector<HTMLElement>('.hs-submenu .hs-menu__item');
        first?.focus();
        return;
      }
      case 'ArrowLeft':
        if (phone && submenu !== null) {
          event.preventDefault();
          closeSubmenu();
          return;
        }
        if (item.closest('.hs-submenu') !== null) {
          event.preventDefault();
          leaveSubmenu(item);
        }
        return;
      case 'Escape':
        event.preventDefault();
        if (phone && submenu !== null) {
          closeSubmenu();
          return;
        }
        if (item.closest('.hs-submenu') !== null) {
          leaveSubmenu(item);
          return;
        }
        close(true);
        return;
      case 'Tab':
        lastTrigger?.focus();
        close();
        return;
      case 'Enter':
      case ' ':
        if (item.tagName !== 'BUTTON') {
          event.preventDefault();
          item.click();
        }
        return;
      default:
        return;
    }
  }

  /**
   * Shows a submenu in place of the menu on a phone.
   *
   * @param token The identity of the item that opens the submenu.
   * @param label The accessible name of the submenu.
   * @param content The submenu's items.
   */
  function openSubmenu(token: string, label: string, content: Snippet): void {
    submenu = { token, label, content };
    void tick().then(() => {
      focusFirst();
      place();
    });
  }

  /** Returns from a phone submenu to the item that opened it. */
  function closeSubmenu(): void {
    const token = submenu?.token;
    submenu = null;
    void tick().then(() => {
      const item =
        token === undefined
          ? undefined
          : panel?.querySelector<HTMLElement>(`[data-menu-item="${CSS.escape(token)}"]`);
      if (item === null || item === undefined) {
        focusFirst();
        return;
      }
      item.focus();
    });
  }

  setMenuContext({
    close,
    phone: () => phone,
    submenu: () => submenu,
    openSubmenu,
    closeSubmenu
  });

  $effect(() => {
    if (!open) {
      return;
    }
    void tick().then(() => {
      place();
      focusFirst();
    });
  });

  $effect(() => {
    if (!open) {
      return;
    }
    const dismiss = (event: PointerEvent) => {
      if (anchor !== undefined && !anchor.contains(event.target as Node)) {
        close();
      }
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  });

  const triggerProps = $derived<MenuTriggerProps>({
    onclick: toggle,
    'aria-haspopup': 'menu',
    'aria-expanded': open
  });
</script>

<div class="menu-anchor" role="presentation" bind:this={anchor} onkeydown={triggerKey}>
  {#if trigger !== undefined}
    {@render trigger(triggerProps)}
  {:else}
    <button
      class="hs-button hs-button--flat hs-button--icon"
      type="button"
      aria-label={label}
      {...triggerProps}
    >
      <Icon name={icon} class="hs-button__icon" />
    </button>
  {/if}

  {#if open}
    <div
      class="hs-menu menu-panel menu-panel--{placement} menu-panel--{align}"
      role="menu"
      aria-label={submenu !== null && phone ? submenu.label : name}
      tabindex="-1"
      bind:this={panel}
      onkeydown={panelKey}
    >
      {#if submenu !== null && phone}
        <div class="hs-submenu__header">
          <button class="hs-submenu__back" type="button" aria-label="Back" onclick={closeSubmenu}>
            <Icon name="adwaita-back" />
          </button>
          {submenu.label}
        </div>
        <hr />
        {@render submenu.content()}
      {:else}
        {@render children()}
      {/if}
    </div>
  {/if}
</div>

<style>
  .menu-anchor {
    position: relative;
    display: inline-flex;
  }

  .menu-panel {
    position: absolute;
    z-index: 30;
  }

  .menu-panel--below {
    top: 100%;
  }

  .menu-panel--above {
    bottom: 100%;
  }

  .menu-panel--start {
    left: 0;
  }

  .menu-panel--end {
    right: 0;
  }
</style>
