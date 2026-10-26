/**
 * The bounded wait a page gives the enrichment job of the entity it opened.
 *
 * A page starts the window with its own read and ends it either when
 * `catalog.enriched` names the entity - the page's own subscription, which
 * settles the wait in the state `enrichment.ts` decides from - or when the
 * window passes. The timer lives outside the page's state so a read that
 * restarts (a new artist, a Retry) restarts the window with it, and the
 * component unmounting cancels it.
 */
import { onDestroy } from 'svelte';

import { ENRICHMENT_WINDOW_MS } from './enrichment';

/** A page's wait for the enrichment job of one entity. */
export interface EnrichmentWait {
  /** Whether the window has passed. */
  readonly waited: boolean;
  /** Starts (or restarts) the window, from the moment the page reads. */
  restart(): void;
}

/**
 * Creates the wait of one page.
 *
 * Must be called during the component's initialisation, because it registers
 * the cleanup that cancels the timer.
 *
 * @returns The wait, whose `waited` the page reads in its derived state.
 */
export function createEnrichmentWait(): EnrichmentWait {
  let waited = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  onDestroy(() => {
    clearTimeout(timer);
  });

  return {
    get waited() {
      return waited;
    },
    restart() {
      waited = false;
      clearTimeout(timer);
      timer = setTimeout(() => {
        waited = true;
      }, ENRICHMENT_WINDOW_MS);
    }
  };
}
