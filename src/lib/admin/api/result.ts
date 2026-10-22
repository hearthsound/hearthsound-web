/**
 * The answer every admin API call gives its page.
 *
 * A call either returns the value the page shows or the sentence it shows when
 * the server refused; the sentence is built once, with the fallback the call
 * names, so a page never words the failure itself.
 */
import type { components } from '#lib/api/schema';

import { problemMessage } from '../problem';

/** A refused request, as the server words it. */
type Problem = components['schemas']['Problem'];

/** The answer of one admin API call. */
export type AdminResult<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * Wraps the value a call answered with.
 *
 * @param value The value the page shows.
 * @returns The successful answer.
 */
export function okay<T>(value: T): AdminResult<T> {
  return { ok: true, value };
}

/**
 * Wraps the refusal of a call.
 *
 * @param problem The problem the server answered with, when it answered one.
 * @param fallback The sentence to show when it did not.
 * @returns The refused answer.
 */
export function refused<T>(problem: Problem | undefined, fallback: string): AdminResult<T> {
  return { ok: false, message: problemMessage(problem, fallback) };
}

/**
 * Wraps a request whose answer carries no body.
 *
 * @param status The response's status; 204 is the accepted one.
 * @param problem The problem the server answered with, when it answered one.
 * @param fallback The sentence to show when it did not.
 * @returns The successful answer, or the refusal.
 */
export function settled(
  status: number,
  problem: Problem | undefined,
  fallback: string
): AdminResult<void> {
  if (status === 204) {
    return okay(undefined);
  }
  return refused(problem, fallback);
}
