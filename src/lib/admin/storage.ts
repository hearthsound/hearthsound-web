/**
 * The storage the admin view shows.
 *
 * The usage comes from the storage report, and the policy that decides what is
 * kept, evicted and demoted is edited as the server settings that carry it. A
 * forced maintenance pass is the one the background worker runs.
 */
import type { components } from '#lib/api/schema';

import { formatBytes } from '#lib/format';
import type { ServerSetting } from './settings';

/** What one forced maintenance pass changed. */
export type MaintenanceView = components['schemas']['MaintenanceView'];

/** The storage report the usage group draws. */
export type StorageReport = components['schemas']['StorageReport'];

/** One part of the stacked usage bar and its legend entry. */
export interface UsagePart {
  /**
   * The package's bar class, which picks the part's colour: `library` is the
   * acid fill, `cache` the acid at 55%, `folders` the muted grey and `free` the
   * faint foreground. The names are the package's; the labels say what the
   * admin view counts (Library is the scanned folders, Downloads the managed
   * copies).
   */
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
  /** The parts in bar order: library, downloads, cache, then free. */
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
 * The bar is read against the combined total of every filesystem the server
 * reports, which is what the Free legend states; without one the three classes
 * fill the bar. Each width is clamped so rounding cannot overflow the bar, and
 * the free part is whatever the three classes leave over (p26). The scanned
 * folders are the primary Library, the managed copies are Downloads, and the
 * cache keeps its own third of the legend.
 *
 * @param report The storage report.
 * @returns The ordered parts and the pinned line.
 */
export function usageView(report: StorageReport): UsageView {
  const filesystems = report.filesystems ?? [];
  // The bar is read against every filesystem the server touches at once: the
  // storage root's and each scanned folder's. A music library usually lives on
  // a larger disk than the server's own storage, so measuring one of them alone
  // made the bar and the free figure meaningless.
  const capacity = filesystems.reduce((sum, entry) => sum + Math.max(0, entry.totalBytes), 0);
  const free = filesystems.reduce((sum, entry) => sum + Math.max(0, entry.availableBytes), 0);

  const classes = [
    { entry: report.folders, key: 'library' as const, label: 'Library' },
    { entry: report.library, key: 'cache' as const, label: 'Downloads' },
    { entry: report.cache, key: 'folders' as const, label: 'Cache' }
  ];
  const used = classes.reduce((sum, part) => sum + Math.max(0, part.entry.bytes), 0);
  const total = capacity > 0 ? capacity : used;

  const parts: UsagePart[] = [];
  let spent = 0;
  for (const part of classes) {
    const percent = share(part.entry.bytes, total, spent);
    spent += percent;
    parts.push({
      key: part.key,
      label: part.label,
      percent,
      detail: `${formatBytes(part.entry.bytes)} - ${fileCount(part.entry.files)}`
    });
  }

  if (capacity > 0) {
    parts.push({
      key: 'free',
      label: 'Free',
      percent: Math.max(0, 100 - spent),
      detail: `${formatBytes(free)} of ${formatBytes(capacity)}`
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
