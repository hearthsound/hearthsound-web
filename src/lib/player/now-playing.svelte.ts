/**
 * The now-playing view's open state.
 *
 * The view is an overlay over the app rather than a route (l05, l06 C), so the
 * shell renders it when it is open and the player bar, the mini player and the
 * sidebar's Queue row only ask to open it. The store keeps the control that
 * opened it, so closing the view returns focus there (p20-r4).
 *
 * The view cannot open while the queue holds no track (p19-r1 audit), which is
 * the one rule every opener shares; a store that has nothing to show stays
 * shut instead of drawing an empty panel.
 */
import { player } from './player.svelte';

/** The now-playing overlay. */
export class NowPlayingStore {
  /** Whether the view covers the app. */
  opened = $state(false);

  /** The control that opened the view, for focus to return to. */
  opener = $state<HTMLElement | null>(null);

  /**
   * Opens the view when there is a track to show.
   *
   * @returns Whether the view is open; an empty queue leaves it shut.
   */
  open(): boolean {
    if (player.queue.current === null) {
      return false;
    }
    this.opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.opened = true;
    return true;
  }

  /** Closes the view. */
  close(): void {
    this.opened = false;
  }
}

/** The client's now-playing view. */
export const nowPlaying = new NowPlayingStore();
