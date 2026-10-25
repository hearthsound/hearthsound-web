/**
 * The storage endpoints the admin view calls.
 *
 * The report is the usage the page draws; the maintenance pass is the one the
 * background worker runs, forced to run now. Both calls answer through
 * {@link guard}, so a request that never reached the server is a refused answer
 * rather than a thrown rejection.
 */
import { nativeClient } from '#lib/api/native';

import { guard, refused, okay } from './result';
import type { AdminResult } from './result';
import type { MaintenanceView, StorageReport } from '../storage';

/**
 * Reads the storage report.
 *
 * @returns The usage the page draws.
 */
export async function getStorageReport(): Promise<AdminResult<StorageReport>> {
  return guard(async () => {
    const answer = await nativeClient.GET('/api/v1/admin/storage');
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not load the storage.', answer.response.status);
    }
    return okay(answer.data);
  });
}

/**
 * Runs one maintenance pass now.
 *
 * @returns What the pass changed.
 */
export async function runMaintenance(): Promise<AdminResult<MaintenanceView>> {
  return guard(async () => {
    const answer = await nativeClient.POST('/api/v1/admin/storage/evict');
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not run the maintenance pass.', answer.response.status);
    }
    return okay(answer.data);
  });
}
