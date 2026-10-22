/**
 * Tests for the storage policy form and what a maintenance pass reports.
 */
import { describe, expect, it } from 'vitest';

import { STORAGE_POLICY_KEYS, maintenanceText, policySettings, usageView } from './storage';
import type { ServerSetting } from './settings';
import type { StorageReport } from './storage';

/**
 * Builds one registered setting.
 *
 * @param key The dotted setting key.
 * @returns The setting.
 */
function setting(key: string): ServerSetting {
  return {
    key,
    kind: 'integer',
    allowed: [],
    description: '',
    default: {},
    source: 'database',
    value: {},
    pinned: false,
    environmentPinned: false,
    userOverridable: false
  };
}

describe('storage policy', () => {
  it('picks the policy keys in the order the form shows them', () => {
    const settings = [
      setting('storage.unpin_action'),
      setting('server.port'),
      setting('storage.cache.max_bytes'),
      setting('storage.autopin.play_count'),
      setting('storage.cache.eviction'),
      setting('storage.cache.min_free_bytes'),
      setting('storage.cache.max_age_days')
    ];

    expect(policySettings(settings).map((entry) => entry.key)).toEqual([
      'storage.cache.max_bytes',
      'storage.cache.min_free_bytes',
      'storage.cache.eviction',
      'storage.cache.max_age_days',
      'storage.unpin_action',
      'storage.autopin.play_count'
    ]);
    expect(policySettings(settings)).toHaveLength(STORAGE_POLICY_KEYS.length);
  });

  it('leaves out a policy key the server does not register', () => {
    expect(policySettings([setting('storage.cache.eviction')]).map((entry) => entry.key)).toEqual([
      'storage.cache.eviction'
    ]);
  });
});

describe('maintenance pass', () => {
  it('reports what the pass evicted, moved and pinned', () => {
    const text = maintenanceText({
      autopin: { pinned: 2, released: 1 },
      eviction: { bytes: 2048, files: 3 },
      relocation: { promoted: 1, demoted: 4, deleted: 2 }
    });

    expect(text).toBe('Evicted 3 files (2.0 KiB), moved 5 files, removed 2, changed 3 pins.');
  });
});

/**
 * Builds a storage report around the classes and filesystems it holds.
 *
 * @param filesystems The filesystems, or none when the server reports none.
 * @returns The report.
 */
function report(filesystems: StorageReport['filesystems'] = []): StorageReport {
  return {
    cache: { bytes: 2048, files: 1 },
    library: { bytes: 4096, files: 12 },
    folders: { bytes: 1024, files: 2 },
    pinnedTracks: 3,
    filesystems,
    policy: {
      autopinPlayCount: 0,
      cacheMaxBytes: 0,
      cacheMinFreeBytes: 0,
      eviction: 'lru',
      maxAgeDays: 0,
      unpinAction: 'demote'
    }
  };
}

describe('storage usage', () => {
  it('words each legend entry with its size and file count', () => {
    const view = usageView(report());

    expect(view.parts.map((part) => part.label)).toEqual(['Library', 'Downloads', 'Cache']);
    expect(view.parts.map((part) => part.detail)).toEqual([
      '1.0 KiB - 2 files',
      '4.0 KiB - 12 files',
      '2.0 KiB - 1 file'
    ]);
  });

  it('adds every filesystem when it fills the bar with free space', () => {
    const view = usageView(
      report([
        { availableBytes: 1024, totalBytes: 4096 },
        { availableBytes: 3072, totalBytes: 12_288 }
      ])
    );

    expect(view.parts.map((part) => part.key)).toEqual(['library', 'cache', 'folders', 'free']);
    expect(view.parts.map((part) => Math.round(part.percent))).toEqual([6, 25, 13, 56]);
    expect(view.parts[3]?.detail).toBe('4.0 KiB of 16.0 KiB');
  });

  it('leaves the free part out when the server reports no filesystem', () => {
    expect(usageView(report()).parts.map((part) => part.key)).toEqual([
      'library',
      'cache',
      'folders'
    ]);
  });

  it('counts the pinned tracks', () => {
    expect(usageView(report()).pinned).toBe('Pinned tracks: 3');
  });
});
