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
  import { SUBMENU_GAP, submenuPlacement } from './menu-placement';

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
    /** Extra classes for the anchor, for a trigger that fills its column. */
    class?: string;
    /** Extra classes for the menu surface, for a menu of a fixed width. */
    panelClass?: string;
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
    class: extra = '',
    panelClass = '',
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
   * The elements one menu level counts as its items.
   *
   * Every `MenuItem` carries the shared item class; a menu may also hold
   * feature content of its own (the song menu's feedback and rating rows),
   * whose focusable controls opt into the same keyboard order with
   * `data-menu-item`. Those controls sit inside a row of their own, so they
   * are found anywhere in the level; a control that belongs to a cascading
   * submenu is left to that submenu.
   */
  const ITEM_SELECTOR = '.hs-menu__item, [data-menu-item]';

  /**
   * Returns the menu items of one menu level, skipping disabled items.
   *
   * @param level The menu element whose items are returned.
   * @returns The focusable items, in order.
   */
  function itemsOf(level: HTMLElement): HTMLElement[] {
    return Array.from(
      level.querySelectorAll<HTMLElement>(`:scope > .hs-menu__item, [data-menu-item]`)
    )
      .filter((item) => item.closest('[role="menu"]') === level)
      .filter((item) => item.getAttribute('aria-disabled') !== 'true');
  }

  /** Focuses the first item of the level that is on screen. */
  function focusFirst(): void {
    if (panel === undefined) {
      return;
    }
    itemsOf(panel)[0]?.focus();
  }

  /** The space the panel keeps from the viewport edges. */
  const VIEWPORT_MARGIN = 8;

  /**
   * Places the open panel against the viewport from the trigger's rectangle.
   *
   * A list, a card and a page all hide their overflow, so a panel positioned
   * inside one is cut off at the box's edge, and focusing its first item makes
   * the page scroll to reach the clipped part. The panel is therefore
   * `position: fixed`, which no scrolling or clipping box contains, and this
   * computes its viewport coordinates. It stays in the trigger's subtree, so
   * the row around the trigger keeps its hover and focus styles while the
   * pointer or focus is in the menu.
   *
   * It opens below the trigger when that side has room and above it otherwise,
   * stays inside the viewport horizontally, and scrolls within itself when the
   * viewport cannot hold its height. An ancestor with a transform makes itself
   * the panel's containing block, so the coordinates are corrected by where the
   * panel actually lands.
   */
  function place(): void {
    if (panel === undefined || anchor === undefined) {
      return;
    }
    panel.style.maxHeight = '';
    panel.style.overflowY = '';
    const trigger = anchor.getBoundingClientRect();
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const roomBelow = viewportHeight - VIEWPORT_MARGIN - trigger.bottom;
    const roomAbove = trigger.top - VIEWPORT_MARGIN;
    const below = roomBelow >= height || roomBelow >= roomAbove;
    placement = below ? 'below' : 'above';
    const available = Math.max(below ? roomBelow : roomAbove, 0);
    const shown = Math.min(height, available);

    const wanted = align === 'end' ? trigger.right - width : trigger.left;
    const left = Math.min(
      Math.max(wanted, VIEWPORT_MARGIN),
      Math.max(viewportWidth - VIEWPORT_MARGIN - width, VIEWPORT_MARGIN)
    );
    const top = below ? trigger.bottom : trigger.top - shown;

    panel.style.left = `${Math.round(left)}px`;
    panel.style.top = `${Math.round(top)}px`;
    if (height > available) {
      panel.style.maxHeight = `${Math.round(available)}px`;
      panel.style.overflowY = 'auto';
    }
    const landed = panel.getBoundingClientRect();
    const driftX = landed.left - left;
    const driftY = landed.top - top;
    if (Math.abs(driftX) >= 1 || Math.abs(driftY) >= 1) {
      panel.style.left = `${Math.round(left - driftX)}px`;
      panel.style.top = `${Math.round(top - driftY)}px`;
    }
    panel.style.visibility = 'visible';
  }

  /**
   * Keeps every open cascading submenu inside the viewport.
   *
   * A submenu opens beside its item, which pushes it past the right edge when
   * the menu itself is anchored there; it flips to the left in that case and
   * moves up when its bottom would leave the viewport. The geometry decision is
   * {@link submenuPlacement}; this applies it to the submenus on screen.
   */
  function placeSubmenus(): void {
    if (panel === undefined) {
      return;
    }
    for (const submenu of panel.querySelectorAll<HTMLElement>('.hs-submenu')) {
      const item = submenu.parentElement;
      if (item === null) {
        continue;
      }
      const box = submenu.getBoundingClientRect();
      const where = submenuPlacement(
        item.getBoundingClientRect(),
        { width: box.width, height: box.height },
        { width: window.innerWidth, height: window.innerHeight }
      );
      if (where.side === 'start') {
        submenu.style.left = 'auto';
        submenu.style.right = `calc(100% + ${SUBMENU_GAP}px)`;
      } else {
        submenu.style.left = '';
        submenu.style.right = '';
      }
      submenu.style.top = where.offset === 0 ? '' : `${where.offset}px`;
      submenu.style.maxHeight = where.maxHeight === null ? '' : `${where.maxHeight}px`;
      submenu.style.overflowY = where.maxHeight === null ? '' : 'auto';
    }
  }

  /**
   * Closes the menu.
   *
   * @param restoreFocus Whether focus returns to the trigger. It moves before
   *   the menu unmounts, so a dialog the choice opens records the trigger as
   *   its opener and gives focus back to it when it closes.
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
      target?.focus();
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
    const item = (event.target as HTMLElement).closest<HTMLElement>(ITEM_SELECTOR);
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
        placeSubmenus();
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
      placeSubmenus();
      focusFirst();
    });
  });

  // A submenu is opened by its item, inside this menu's content, so the menu
  // watches its panel for one appearing and places it; a resized window or a
  // scrolled page moves an open one too, because the panel follows its trigger.
  $effect(() => {
    if (!open || panel === undefined) {
      return;
    }
    const observer = new MutationObserver(() => {
      place();
      placeSubmenus();
    });
    observer.observe(panel, { childList: true, subtree: true });
    const follow = (): void => {
      place();
      placeSubmenus();
    };
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
    };
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

<div class="menu-anchor {extra}" role="presentation" bind:this={anchor} onkeydown={triggerKey}>
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
      class="hs-menu {panelClass} menu-panel menu-panel--{placement} menu-panel--{align}"
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

  /* `place()` writes the panel's viewport coordinates; a fixed panel escapes
     the lists and pages that clip their overflow. It stays hidden until it has
     been placed, so it never paints at the corner of its containing block. */
  .menu-panel {
    position: fixed;
    z-index: 30;
    visibility: hidden;
  }
</style>
