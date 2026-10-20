import { getContext, setContext } from 'svelte';
import type { Snippet } from 'svelte';

/**
 * The submenu the menu currently shows.
 *
 * A phone replaces the menu with the submenu, so the menu itself owns the
 * content. A desktop item renders its own submenu beside itself and only uses
 * the token to know whether it is the open one.
 */
export interface MenuSubmenu {
  /** The identity of the item that opened the submenu. */
  token: string;
  /** The accessible name of the submenu. */
  label: string;
  /** The items of the submenu. */
  content: Snippet;
}

/** What a menu item may ask of the menu that holds it. */
export interface MenuContext {
  /** Closes the menu, optionally returning focus to the trigger. */
  close: (restoreFocus?: boolean) => void;
  /** Whether the viewport is narrow enough to replace the menu with its submenu. */
  phone: () => boolean;
  /** The submenu currently shown, when the menu is on a phone. */
  submenu: () => MenuSubmenu | null;
  /** Shows a submenu in place of the menu (phones). */
  openSubmenu: (token: string, label: string, content: Snippet) => void;
  /** Returns from the submenu to the menu (phones). */
  closeSubmenu: () => void;
}

const key = Symbol('hearthsound-menu');

/**
 * Makes a menu available to the items it holds.
 *
 * @param context The menu's commands and state.
 */
export function setMenuContext(context: MenuContext): void {
  setContext(key, context);
}

/**
 * Returns the menu that holds the calling item.
 *
 * @returns The menu's commands and state, or `undefined` outside a menu.
 */
export function getMenuContext(): MenuContext | undefined {
  return getContext<MenuContext | undefined>(key);
}
