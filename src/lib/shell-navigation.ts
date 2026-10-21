/**
 * The shell command a page header needs.
 *
 * The shell owns the phone drawer, so a page that draws its own k25 header
 * takes the "Open Navigation" command from it. The sign-in and setup pages draw
 * without the shell and simply have no command.
 */
import { getContext, setContext } from 'svelte';

/** What a page header may ask of the shell. */
export interface ShellNavigation {
  /** Opens the phone drawer. */
  openNavigation: () => void;
}

const key = Symbol('hearthsound-shell-navigation');

/**
 * Makes the shell's commands available to the pages it renders.
 *
 * @param navigation The shell's commands.
 */
export function setShellNavigation(navigation: ShellNavigation): void {
  setContext(key, navigation);
}

/**
 * Returns the shell's commands for the calling page.
 *
 * @returns The commands, or `undefined` outside the shell.
 */
export function getShellNavigation(): ShellNavigation | undefined {
  return getContext<ShellNavigation | undefined>(key);
}
