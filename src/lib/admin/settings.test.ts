/**
 * Tests for the setting editors: how a value is shown, what a field stands for
 * and which body a change sends.
 */
import { describe, expect, it } from 'vitest';

import {
  groupSettings,
  settingPatch,
  settingText,
  settingValue,
  visibleSettings
} from './settings';
import type { ServerSetting } from './settings';

/**
 * Builds one registered setting around the value it carries.
 *
 * @param key The dotted setting key.
 * @param kind The value's shape.
 * @param value The effective value.
 * @returns The setting.
 */
function setting(key: string, kind: string, value: unknown): ServerSetting {
  // The server's document describes a `Value` field as an empty object; what
  // the key holds is the value handed in here.
  const carried = value as Record<string, never>;
  return {
    key,
    kind,
    description: '',
    default: carried,
    source: 'default',
    value: carried,
    pinned: false,
    environmentPinned: false,
    userOverridable: false
  };
}

describe('setting groups', () => {
  it('leaves the bootstrap-only public address off the page', () => {
    const settings = [
      setting('server.base_url', 'string', 'https://music.example.org'),
      setting('uploads.enabled', 'bool', true)
    ];

    expect(visibleSettings(settings).map((entry) => entry.key)).toEqual(['uploads.enabled']);
  });

  it('groups settings by the first segment of their key', () => {
    const groups = groupSettings([
      setting('storage.cache.max_bytes', 'integer', 1024),
      setting('acquisition.max_concurrent', 'integer', 2),
      setting('storage.unpin_action', 'string', 'demote')
    ]);

    expect(groups.map((group) => group.segment)).toEqual(['storage', 'acquisition']);
    expect(groups[0].settings.map((entry) => entry.key)).toEqual([
      'storage.cache.max_bytes',
      'storage.unpin_action'
    ]);
  });

  it('keeps a key without a segment in a group of its own', () => {
    expect(groupSettings([setting('log_level', 'string', 'info')])[0].segment).toBe('log_level');
  });
});

describe('setting text', () => {
  it('writes a value the way its editor holds it', () => {
    expect(settingText(setting('a', 'integer', 12))).toBe('12');
    expect(settingText(setting('a', 'bool', true))).toBe('true');
    expect(settingText(setting('a', 'string', 'demote'))).toBe('demote');
    expect(settingText(setting('a', 'stringList', ['flac', 'mp3']))).toBe('flac\nmp3');
  });

  it('writes nothing for a value the setting does not have', () => {
    expect(settingText(setting('a', 'string', null))).toBe('');
  });
});

describe('setting value', () => {
  it('reads a whole number and a decimal from their fields', () => {
    expect(settingValue('integer', '12.7')).toBe(12);
    expect(settingValue('float', '1.5')).toBe(1.5);
  });

  it('reads a list of strings and a switch from their fields', () => {
    expect(settingValue('stringList', 'flac\n mp3 ')).toEqual(['flac', 'mp3']);
    expect(settingValue('bool', 'true')).toBe(true);
    expect(settingValue('bool', 'false')).toBe(false);
    expect(settingValue('string', ' demote ')).toBe(' demote ');
  });

  it('removes the stored value for a field that was cleared', () => {
    expect(settingValue('integer', '')).toBeNull();
    expect(settingValue('string', '   ')).toBeNull();
    expect(settingValue('stringList', '')).toBeNull();
    expect(settingValue('integer', 'many')).toBeNull();
  });
});

describe('setting patches', () => {
  it('carries one key at a time', () => {
    expect(settingPatch('storage.cache.eviction', 'lru')).toEqual({
      settings: { 'storage.cache.eviction': 'lru' }
    });
  });

  it('removes a stored value with null', () => {
    expect(settingPatch('storage.autopin.play_count', null)).toEqual({
      settings: { 'storage.autopin.play_count': null }
    });
  });
});
