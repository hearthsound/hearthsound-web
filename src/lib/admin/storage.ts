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

/** The storage report the usage group draws. */
export type StorageReport = components['schemas']['StorageReport'];

/** One part of the stacked usage bar and its legend entry. */
export interface UsagePart {
  /** The class the part counts, which picks its bar and swatch colour. */
  key: 'library' | 'cache' | 'folders' | 'free';
  /** The legend label. */
  label: string;
  /** The width of the part in percent of the bar. */
  percent: number;
  /** The muted legend line under the label. */
  detail: string;
}

/** The usage bar, its legend and the pinned-track count. */
export interface UsageView {
  /** The parts in bar order: library, cache, folders, then free. */
  parts: UsagePart[];
  /** The line under the legend, e.g. "Pinned tracks: 312". */
  pinned: string;
}

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
 * Returns the usage bar, its legend and the pinned-track line.
 *
 * The bar is read against the filesystem's total when the server reports one,
 * which is what the Free legend states; without it the three classes fill the
 * bar. Each width is clamped so rounding cannot overflow the bar, and the free
 * part is whatever the three classes leave over (p26).
 *
 * @param report The storage report.
 * @returns The ordered parts and the pinned line.
 */
export function usageView(report: StorageReport): UsageView {
  const filesystem = report.filesystem;
  const classes = [report.library, report.cache, report.folders];
  const used = classes.reduce((sum, entry) => sum + Math.max(0, entry.bytes), 0);
  const total = filesystem !== null && filesystem !== undefined ? filesystem.totalBytes : used;

  const parts: UsagePart[] = [];
  let spent = 0;
  const keys: ReadonlyArray<UsagePart['key']> = ['library', 'cache', 'folders'];
  const labels = ['Library', 'Cache', 'Folders'];
  for (const [index, entry] of classes.entries()) {
    const percent = share(entry.bytes, total, spent);
    spent += percent;
    parts.push({
      key: keys[index] ?? 'library',
      label: labels[index] ?? '',
      percent,
      detail: `${formatBytes(entry.bytes)} - ${fileCount(entry.files)}`
    });
  }

  if (filesystem !== null && filesystem !== undefined) {
    parts.push({
      key: 'free',
      label: 'Free',
      percent: Math.max(0, 100 - spent),
      detail: `${formatBytes(filesystem.availableBytes)} of ${formatBytes(filesystem.totalBytes)}`
    });
  }

  return { parts, pinned: `Pinned tracks: ${report.pinnedTracks}` };
}

/**
 * Returns the width one class takes on the bar.
 *
 * @param bytes What the class holds.
 * @param total The bar's total, or zero when there is nothing to compare.
 * @param spent The percentage the earlier classes already took.
 * @returns The percentage from 0 to what is left of the bar.
 */
function share(bytes: number, total: number, spent: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(Math.max(0, 100 - spent), Math.max(0, (bytes / total) * 100));
}

/**
 * Counts files in singular and plural form (E5).
 *
 * @param files How many files.
 * @returns `1 file` or `<N> files`.
 */
function fileCount(files: number): string {
  return `${files} ${files === 1 ? 'file' : 'files'}`;
}

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
