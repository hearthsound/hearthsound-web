/**
 * The state of a page a catalog entity was opened on.
 *
 * The server answers a catalog artist or album from its caches first and runs
 * the enrichment job behind the request, so the page a listener opens holds
 * what is already stored and nothing else until the job publishes
 * `catalog.enriched`. A page in that state must not claim the entity has
 * nothing: it is waiting for content, not missing it. These two predicates are
 * what the artist and album pages decide that from, so the two pages cannot
 * word the same situation differently.
 *
 * The pages cannot ask the server where an entity came from: `getArtist` and
 * `getAlbum` name no origin, and an artist the library already holds gains
 * catalog albums and top songs from the job just as an online one does. What a
 * page can know is whether the event for its entity arrived, whether it already
 * holds something the job would add, and how long it has waited, which is what
 * the state below carries.
 */

/**
 * How long a page waits for the enrichment job before it may say it has
 * nothing.
 *
 * The wait is bounded because a job that never publishes - a server without a
 * job queue, or a provider that keeps failing - must not leave the page
 * shimmering forever. It matches the end-to-end suite's own wait, so a page and
 * the tests that drive it stop waiting together.
 */
export const ENRICHMENT_WINDOW_MS = 30_000;

/** What a page knows about the entity it opened. */
export interface EnrichmentState {
  /** Whether the enrichment event for this entity has arrived. */
  settled: boolean;
  /** Whether the page already holds something the job would add. */
  hasExtras: boolean;
  /** Whether the page has waited the whole {@link ENRICHMENT_WINDOW_MS}. */
  waited: boolean;
}

/**
 * Reports whether a page is waiting for the enrichment job of its entity.
 *
 * @param state What the page knows.
 * @returns `true` until the event for the entity arrives, the page holds
 *   something the job would add, or the window has passed.
 */
export function awaitingEnrichment(state: EnrichmentState): boolean {
  return !state.settled && !state.hasExtras && !state.waited;
}

/** What a page's own read reported, for the empty line it may draw. */
export interface EmptyLineState extends EnrichmentState {
  /** Whether the page's own read is still running. */
  loading: boolean;
  /** Whether the page's own read failed, which is not emptiness. */
  failed: boolean;
}

/**
 * Reports whether a page may say it has nothing to show.
 *
 * A page that is still reading says nothing, a failed read keeps its own line
 * and offers a retry, and a page whose enrichment may still arrive waits
 * instead of claiming the entity is empty.
 *
 * @param state What the page knows.
 * @returns `true` when the empty line belongs on the page.
 */
export function showsEmptyLine(state: EmptyLineState): boolean {
  if (state.loading || state.failed || state.hasExtras) {
    return false;
  }
  return !awaitingEnrichment(state);
}
