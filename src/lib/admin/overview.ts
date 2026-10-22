/**
 * The administration overview: the cards, their counts and their lines.
 *
 * Each card is one area's entry into the overview - its id, title, icon, link
 * and the read that supplies its count - so a new area adds one entry instead
 * of another hand-wired block. The reads are the area facades, and a page only
 * draws the bodies this module shapes.
 */
import type { IconName } from '@hearthsound/design/icons';

import { formatBytes } from '#lib/format';
import type { PillTone } from '#lib/ui/Pill.svelte';
import { listAcquisitions } from './api/acquisitions';
import { listFolders } from './api/folders';
import { listPlugins } from './api/plugins';
import { listProviders } from './api/providers';
import { okay } from './api/result';
import type { AdminResult } from './api/result';
import { getStorageReport } from './api/storage';
import { loadAllUsers } from './api/users';
import { lastScanText } from './folders';
import type { FolderView } from './folders';
import type { PluginView } from './plugins';
import type { ProviderView } from './providers';
import type { StorageReport } from './storage';
import type { AdminUser } from './users';

/** One health state a provider reports, with how many instances hold it. */
export interface HealthCount {
  /** The state colour. */
  tone: PillTone;
  /** The state glyph. */
  glyph: IconName;
  /** The visible label. */
  label: string;
  /** How many instances are in that state. */
  count: number;
}

/** A card body that draws a number and its context line. */
export interface CountBody {
  /** Which body this is. */
  kind: 'count';
  /** The number the card leads with. */
  number: number;
  /** The muted line under the number. */
  line: string;
}

/** A card body that draws the provider health states beside the count. */
export interface ProvidersBody {
  /** Which body this is. */
  kind: 'providers';
  /** The number of configured instances. */
  number: number;
  /** The states that have at least one instance. */
  states: HealthCount[];
}

/** A card body that draws the disk usage as a bar and a line. */
export interface StorageBody {
  /** Which body this is. */
  kind: 'storage';
  /** The used percentage of the combined disk space. */
  percent: number;
  /** The muted line under the bar. */
  line: string;
}

/** What one card draws under its heading. */
export type CardBody = CountBody | ProvidersBody | StorageBody;

/** The counts every card reads, gathered once per page load. */
export interface OverviewData {
  /** Every account. */
  users: AdminUser[];
  /** Every music folder. */
  folders: FolderView[];
  /** Every installed plugin. */
  plugins: PluginView[];
  /** Every configured instance. */
  providers: ProviderView[];
  /** The storage report. */
  storage: StorageReport;
  /** How many acquisitions still hold work. */
  running: number;
  /** How many recent acquisitions failed. */
  failed: number;
}

/** How many acquisitions one overview read asks for. */
const ACQUISITION_PAGE = 50;

/** One card of the overview. */
export interface AdminCard {
  /** The area's id, which the card is keyed by. */
  id: string;
  /** The card's heading. */
  title: string;
  /** The heading's glyph. */
  icon: IconName;
  /** The admin route the card opens. */
  href: string;
  /** Reads the counts this card draws. */
  read: () => Promise<AdminResult<Partial<OverviewData>>>;
  /**
   * Shapes the card's body from the loaded counts.
   *
   * @param data Every count the page loaded.
   * @param scans What the event stream last said about each folder's scan.
   * @returns The body to draw.
   */
  body: (data: OverviewData, scans: Record<string, LiveScanLine>) => CardBody;
}

/** What the overview needs to know about one folder's live scan. */
export interface LiveScanLine {
  /** The scan phase the server reported. */
  phase: string;
  /** How many files the scan has read. */
  filesDone: number;
  /** How many files the scan has seen. */
  filesSeen: number;
}

/** The cards of the overview, in drawing order. */
export const ADMIN_CARDS: readonly AdminCard[] = [
  {
    id: 'users',
    title: 'Users',
    icon: 'adwaita-users',
    href: '/admin/users',
    read: async () => {
      const result = await loadAllUsers();
      return result.ok ? okay({ users: result.value }) : result;
    },
    body: (data) => {
      const administrators = data.users.filter((user) => user.isAdmin).length;
      return {
        kind: 'count',
        number: data.users.length,
        line: `${administrators} ${administrators === 1 ? 'administrator' : 'administrators'}`
      };
    }
  },
  {
    id: 'folders',
    title: 'Music folders',
    icon: 'adwaita-folder',
    href: '/admin/folders',
    read: async () => {
      const result = await listFolders();
      return result.ok ? okay({ folders: result.value }) : result;
    },
    body: (data, scans) => ({
      kind: 'count',
      number: data.folders.length,
      line: folderLine(data.folders, scans)
    })
  },
  {
    id: 'plugins',
    title: 'Plugins',
    icon: 'adwaita-plugin',
    href: '/admin/plugins',
    read: async () => {
      const result = await listPlugins();
      return result.ok ? okay({ plugins: result.value }) : result;
    },
    body: (data) => ({ kind: 'count', number: data.plugins.length, line: 'installed' })
  },
  {
    id: 'providers',
    title: 'Providers',
    icon: 'adwaita-remote',
    href: '/admin/providers',
    read: async () => {
      const result = await listProviders();
      return result.ok ? okay({ providers: result.value }) : result;
    },
    body: (data) => ({
      kind: 'providers',
      number: data.providers.length,
      states: healthCounts(data.providers)
    })
  },
  {
    id: 'storage',
    title: 'Storage',
    icon: 'adwaita-storage',
    href: '/admin/storage',
    read: async () => {
      const result = await getStorageReport();
      return result.ok ? okay({ storage: result.value }) : result;
    },
    body: (data) => disk(data.storage)
  },
  {
    id: 'acquisitions',
    title: 'Acquisitions',
    icon: 'adwaita-acquire',
    href: '/admin/acquisitions',
    read: async () => {
      const [active, recent] = await Promise.all([
        listAcquisitions('active', null, ACQUISITION_PAGE),
        listAcquisitions('recent', null, ACQUISITION_PAGE)
      ]);
      if (!active.ok) {
        return active;
      }
      if (!recent.ok) {
        return recent;
      }
      return okay({
        running: active.value.items.length,
        failed: recent.value.items.filter((row) => row.state === 'failed').length
      });
    },
    body: (data) => ({
      kind: 'count',
      number: data.running,
      line: `${data.failed} failed`
    })
  }
];

/**
 * Reads the counts of every card.
 *
 * A card that cannot be read fails the whole page, because the overview is one
 * group of counts and a card without its count would say something untrue.
 *
 * @returns Every count, or the first refusal.
 */
export async function readOverview(): Promise<AdminResult<OverviewData>> {
  const results = await Promise.all(ADMIN_CARDS.map((card) => card.read()));
  const merged: Partial<OverviewData> = {};
  for (const result of results) {
    if (!result.ok) {
      return result;
    }
    Object.assign(merged, result.value);
  }
  return okay(merged as OverviewData);
}

/**
 * Returns the folders card's line.
 *
 * @param folders Every folder.
 * @param scans What the event stream last said about each folder's scan.
 * @returns The live scan's line, or the line of the folder scanned last.
 */
export function folderLine(
  folders: readonly FolderView[],
  scans: Readonly<Record<string, LiveScanLine>>
): string {
  const live = Object.values(scans).find((scan) => scan.phase !== 'done');
  if (live !== undefined) {
    return `${live.phase === 'pruning' ? 'Removing missing files' : 'Scanning'}: ${live.filesDone} of ${live.filesSeen} files`;
  }
  const latest = folders
    .map((folder) => folder.lastScanAt ?? 0)
    .reduce((newest, at) => (at > newest ? at : newest), 0);
  return lastScanText(latest === 0 ? null : latest);
}

/**
 * Counts the provider health states present.
 *
 * @param entries The instances to count.
 * @returns One entry per state that has at least one instance, in the order
 *   healthy, failed, not checked.
 */
export function healthCounts(entries: readonly ProviderView[]): HealthCount[] {
  const counts: HealthCount[] = [
    { tone: 'success', glyph: 'adwaita-check', label: 'Ready', count: 0 },
    { tone: 'error', glyph: 'adwaita-error', label: 'Failed', count: 0 },
    { tone: 'neutral', glyph: 'custom-unknown', label: 'Not checked yet', count: 0 }
  ];
  for (const entry of entries) {
    if (entry.health === null || entry.health === undefined) {
      counts[2].count += 1;
    } else if (entry.health.ok) {
      counts[0].count += 1;
    } else {
      counts[1].count += 1;
    }
  }
  return counts.filter((state) => state.count > 0);
}

/**
 * Shapes the storage card's body.
 *
 * @param report The storage report.
 * @returns The used percentage and the line naming the bytes.
 */
function disk(report: StorageReport): StorageBody {
  const used = report.library.bytes + report.cache.bytes + report.folders.bytes;
  const total = (report.filesystems ?? []).reduce((sum, entry) => sum + entry.totalBytes, 0);
  const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
  return {
    kind: 'storage',
    percent,
    line: total > 0 ? `${formatBytes(used)} of ${formatBytes(total)}` : formatBytes(used)
  };
}
