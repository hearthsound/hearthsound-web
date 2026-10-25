/**
 * The answer every admin API call gives its page.
 *
 * A call either returns the value the page shows or the sentence it shows when
 * the server refused, together with the status the server answered; the
 * sentence is built once, with the fallback the call names, so a page never
 * words the failure itself. {@link guard} turns a request that never reached
 * the server into the same refused answer, so no caller has to catch and a
 * page's busy flag never depends on a thrown rejection.
 */
import type { components } from '#lib/api/schema';

import { problemMessage } from '../problem';

/** A refused request, as the server words it. */
type Problem = components['schemas']['Problem'];

/** The sentence a call shows when the request never reached the server. */
export const NO_ANSWER = 'The server did not answer. Try again in a moment.';

/**
 * The answer of one admin API call.
 *
 * `status` is the status the server answered with, or 0 when the request never
 * reached it; a page can therefore tell a refused session from a refusal that
 * names a value.
 */
export type AdminResult<T> =
  { ok: true; value: T } | { ok: false; message: string; status: number };

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
 * @param status The status the server answered with.
 * @returns The refused answer.
 */
export function refused<T>(
  problem: Problem | undefined,
  fallback: string,
  status: number
): AdminResult<T> {
  return { ok: false, message: problemMessage(problem, fallback), status };
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
  return refused(problem, fallback, status);
}

/**
 * Runs one call and answers a request that never reached the server.
 *
 * The failure arm is the module's only failure shape, including a request the
 * network refused, so every caller checks one kind of answer.
 *
 * @param call The request to run.
 * @param fallback The sentence to show when the request never reached the
 *   server; {@link NO_ANSWER} when the call names none.
 * @returns The call's answer, or the refused answer for a request that threw.
 */
export async function guard<T>(
  call: () => Promise<AdminResult<T>>,
  fallback = NO_ANSWER
): Promise<AdminResult<T>> {
  try {
    return await call();
  } catch {
    return { ok: false, message: fallback, status: 0 };
  }
}
