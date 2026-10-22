/**
 * Where the search results return to (p18 A, b01).
 *
 * Typing in a search field replaces the content column with the results, so
 * clearing the field - with its clear action, with Escape, or from the results
 * page's own field on phones - returns to the page the search was opened from.
 * The shell records that page when it opens the results; both search fields
 * call {@link returnFromSearch}, so the sidebar field and the page field share
 * one rule.
 */
import { goBack, navigate } from './navigation';

/** The page the current search was opened from, or `null` after a direct visit. */
let origin: string | null = null;

/**
 * Records the page the search was opened from.
 *
 * @param path The path the browser shows before the results.
 */
export function rememberSearchOrigin(path: string): void {
  origin = path;
}

/** Forgets the recorded page once the browser left the results (p18). */
export function forgetSearchOrigin(): void {
  origin = null;
}

/**
 * Returns from the search results to the page they were opened from.
 *
 * A search opened by a link or a direct visit has no recorded page: Back
 * returns to what the browser shows before the results, and a first page falls
 * back to the library, where the client opens.
 */
export function returnFromSearch(): void {
  const target = origin;
  origin = null;
  if (target !== null) {
    void navigate(target, { replace: true });
    return;
  }
  goBack('/library/albums');
}
