/**
 * The storage the admin view shows.
 *
 * The usage comes from the storage report, and the policy that decides what is
 * kept, evicted and demoted is edited as the server settings that carry it. A
 * forced maintenance pass is the one the background worker runs.
 */
import type { components } from '#lib/api/schema';

import { formatBytes } from './bytes';
import type { ServerSetting } from './settings';

/** What one forced maintenance pass changed. */
export type MaintenanceView = components['schemas']['MaintenanceView'];

/** The settings the storage policy form edits, in the order it shows them. */
export const STORAGE_POLICY_KEYS: readonly string[] = [
  'storage.cache.max_bytes',
  'storage.cache.min_free_bytes',
  'storage.cache.eviction',
  'storage.cache.max_age_days',
  'storage.unpin_action',
  'storage.autopin.play_count'
];

/**
 * Returns the policy settings of a listing.
 *
 * @param settings Every registered setting.
 * @returns The settings that decide the storage policy, in the order the form
 *   shows them; a key the server does not register is left out.
 */
export function policySettings(settings: readonly ServerSetting[]): ServerSetting[] {
  const policy: ServerSetting[] = [];
  for (const key of STORAGE_POLICY_KEYS) {
    const setting = settings.find((candidate) => candidate.key === key);
    if (setting !== undefined) {
      policy.push(setting);
    }
  }
  return policy;
}

/**
 * Returns what one maintenance pass changed.
 *
 * @param result The pass's outcome.
 * @returns The line the view shows.
 */
export function maintenanceText(result: MaintenanceView): string {
  const pinned = result.autopin.pinned + result.autopin.released;
  const moved = result.relocation.promoted + result.relocation.demoted;
  return (
    `Evicted ${result.eviction.files} files (${formatBytes(result.eviction.bytes)}), ` +
    `moved ${moved} files, removed ${result.relocation.deleted}, changed ${pinned} pins.`
  );
}
