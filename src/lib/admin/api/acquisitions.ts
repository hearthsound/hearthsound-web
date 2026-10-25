/**
 * The acquisition endpoints the admin ledger calls.
 *
 * A listing pages by an opaque cursor and is shaped as the shared paged-list
 * page; the two commands answer with the row's new state - cancel with nothing,
 * retry with the attempt the server admitted or joined. Every call answers
 * through {@link guard}, so a request that never reached the server is a
 * refused answer rather than a thrown rejection.
 */
import type { components } from '#lib/api/schema';
import { nativeClient } from '#lib/api/native';
import type { Page } from '#lib/paging.svelte';

import { guard, refused, okay, settled } from './result';
import type { AdminResult } from './result';
import type { AcquisitionView } from '../acquisitions';

/** The outcome of one retry request. */
export type RetryView = components['schemas']['RetryView'];

/** The group of the ledger a page comes from. */
export type AcquisitionState = 'active' | 'recent' | 'all';

/**
 * Reads one page of acquisitions.
 *
 * @param state The group to read.
 * @param cursor The cursor of the page to read, or `null` for the first one.
 * @param limit How many rows the page may hold.
 * @returns The page, ready for a paged list.
 */
export async function listAcquisitions(
  state: AcquisitionState,
  cursor: string | null,
  limit: number
): Promise<AdminResult<Page<AcquisitionView, string>>> {
  return guard(async () => {
    const answer = await nativeClient.GET('/api/v1/admin/acquisitions', {
      params: {
        query: cursor === null ? { state, limit } : { state, limit, cursor }
      }
    });
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not load the acquisitions.', answer.response.status);
    }
    return okay({ items: answer.data.acquisitions, next: answer.data.nextCursor ?? null });
  });
}

/**
 * Cancels one acquisition that still holds work.
 *
 * @param id The acquisition's id (`ac_...`).
 * @returns Nothing, or the refusal.
 */
export async function cancelAcquisition(id: string): Promise<AdminResult<void>> {
  return guard(async () => {
    const answer = await nativeClient.POST('/api/v1/admin/acquisitions/{id}/cancel', {
      params: { path: { id } }
    });
    return settled(answer.response.status, answer.error, 'Could not cancel the acquisition.');
  });
}

/**
 * Starts a new attempt for one acquisition that ended without a file.
 *
 * @param id The acquisition's id (`ac_...`).
 * @returns The attempt the server admitted or joined.
 */
export async function retryAcquisition(id: string): Promise<AdminResult<RetryView>> {
  return guard(async () => {
    const answer = await nativeClient.POST('/api/v1/admin/acquisitions/{id}/retry', {
      params: { path: { id } }
    });
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not retry the acquisition.', answer.response.status);
    }
    return okay(answer.data);
  });
}
