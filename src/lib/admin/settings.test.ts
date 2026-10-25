/**
 * Tests for the setting editors: how a value is shown, what a field stands for,
 * which body a change sends, what an empty field promises and what a save that
 * never reached the server answers.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nativeClient } from '#lib/api/native';

import { NO_ANSWER } from './api/result';
import { saveSettings } from './api/settings';
import {
  groupSettings,
  settingDefaultText,
  settingPatch,
  settingText,
  settingValue,
  visibleSettings
} from './settings';
import type { ServerSetting } from './settings';

afterEach(() => {
  vi.restoreAllMocks();
});

/**
 * Builds one registered setting around the value it carries.
 *
 * @param key The dotted setting key.
 * @param kind The value's shape.
 * @param value The effective value.
 * @param unit The value's unit, when it has one.
 * @param fallback The built-in default, which is the value when not given.
 * @returns The setting.
 */
function setting(
  key: string,
  kind: string,
  value: unknown,
  unit?: string,
  fallback: unknown = value
): ServerSetting {
  // The server's document describes a `Value` field as an empty object; what
  // the key holds is the value handed in here.
  const carried = value as Record<string, never>;
  const builtin = fallback as Record<string, never>;
  return {
    key,
    kind,
    unit: unit ?? null,
    allowed: [],
    description: '',
    default: builtin,
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

  it('writes a byte-valued setting in GiB', () => {
    expect(settingText(setting('a', 'integer', 0, 'bytes'))).toBe('0');
    expect(settingText(setting('a', 'integer', 1024 ** 3, 'bytes'))).toBe('1');
    expect(settingText(setting('a', 'integer', 1.5 * 1024 ** 3, 'bytes'))).toBe('1.5');
    expect(settingText(setting('a', 'integer', 20 * 1024 ** 3, 'bytes'))).toBe('20');
    expect(settingText(setting('a', 'integer', 0.25 * 1024 ** 3, 'bytes'))).toBe('0.25');
  });

  it('writes nothing for a value the setting does not have', () => {
    expect(settingText(setting('a', 'string', null))).toBe('');
    expect(settingText(setting('a', 'integer', null, 'bytes'))).toBe('');
  });
});

describe('setting value', () => {
  it('reads a whole number and a decimal from their fields', () => {
    expect(settingValue('integer', '12.7')).toBe(12);
    expect(settingValue('float', '1.5')).toBe(1.5);
  });

  it('reads a byte-valued setting in GiB and stores whole bytes', () => {
    expect(settingValue('integer', '0', 'bytes')).toBe(0);
    expect(settingValue('integer', '1', 'bytes')).toBe(1024 ** 3);
    expect(settingValue('integer', '1.5', 'bytes')).toBe(1.5 * 1024 ** 3);
    expect(settingValue('integer', '20', 'bytes')).toBe(20 * 1024 ** 3);
    expect(settingValue('integer', '0.25', 'bytes')).toBe(0.25 * 1024 ** 3);
    expect(settingValue('integer', 1.5, 'bytes')).toBe(1.5 * 1024 ** 3);
  });

  it('removes the stored byte value for a field that was cleared or made no sense', () => {
    expect(settingValue('integer', '', 'bytes')).toBeNull();
    expect(settingValue('integer', 'many', 'bytes')).toBeNull();
    expect(settingValue('integer', '-1', 'bytes')).toBeNull();
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

describe('setting defaults', () => {
  it('shows the built-in default formatted the way a value would be', () => {
    expect(
      settingDefaultText(
        setting('library.naming_template', 'string', '', undefined, 'http://localhost:4327')
      )
    ).toBe('http://localhost:4327');
    expect(
      settingDefaultText(
        setting('library.scan.artist_separators', 'stringList', [], undefined, ['a', 'b'])
      )
    ).toBe('a\nb');
    expect(
      settingDefaultText(setting('storage.cache.max_bytes', 'integer', 0, 'bytes', 20 * 1024 ** 3))
    ).toBe('20');
  });

  it('shows no placeholder for a default that is empty', () => {
    expect(settingDefaultText(setting('library.cover_filename', 'string', '', undefined, ''))).toBe(
      ''
    );
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

describe('a save that never reached the server', () => {
  it('answers the shared refusal instead of throwing', async () => {
    vi.spyOn(nativeClient, 'PATCH').mockRejectedValue(new Error('offline'));

    await expect(saveSettings(settingPatch('storage.cache.eviction', 'lru'))).resolves.toEqual({
      ok: false,
      message: NO_ANSWER,
      status: 0
    });
  });
});
