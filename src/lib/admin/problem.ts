/**
 * The message a failed native API call shows.
 *
 * The server answers a refused request with an RFC 9457 problem document,
 * whose detail says what happened in this occurrence; the views show that
 * sentence and fall back to a plain line when no document arrived.
 */
import type { components } from '#lib/api/schema';

/** A refused request, as the server words it. */
export type Problem = components['schemas']['Problem'];

/**
 * Returns the message to show for a failed call.
 *
 * @param problem The problem the server answered with, when it answered one.
 * @param fallback The message to show when it did not.
 * @returns The message.
 */
export function problemMessage(problem: Problem | undefined, fallback: string): string {
  if (problem === undefined) {
    return fallback;
  }
  return problem.detail ?? problem.title ?? fallback;
}
