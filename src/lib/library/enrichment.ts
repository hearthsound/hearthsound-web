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
 */

/** The origin the server reports for an entity it answered with. */
type Origin = 'library' | 'server' | 'catalog' | string | null | undefined;

/** What a page knows about the entity it opened. */
export interface EnrichmentState {
  /** Where the entity came from: `library`, `server` or `catalog`. */
  origin: Origin;
  /** Whether the enrichment event for this entity has arrived. */
  settled: boolean;
  /** Whether the page already holds something the job would add. */
  hasExtras: boolean;
}

/**
 * Reports whether a page is waiting for the enrichment job of its entity.
 *
 * @param state What the page knows.
 * @returns `true` for a catalog entity the page holds nothing extra for, until
 *   the event for it arrives.
 */
export function awaitingEnrichment(state: EnrichmentState): boolean {
  return state.origin === 'catalog' && !state.settled && !state.hasExtras;
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
 * and offers a retry, and a cold catalog page waits for its enrichment instead
 * of claiming the entity is empty.
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
