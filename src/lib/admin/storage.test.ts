/**
 * Tests for the storage policy form and what a maintenance pass reports.
 */
import { describe, expect, it } from 'vitest';

import { STORAGE_POLICY_KEYS, maintenanceText, policySettings } from './storage';
import type { ServerSetting } from './settings';

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
