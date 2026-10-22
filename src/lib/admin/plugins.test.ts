/**
 * Tests for the wording the plugin views show.
 */
import { describe, expect, it } from 'vitest';

import {
  confirmsInstall,
  installablePlugins,
  pluginStateLabel,
  riskLabel,
  sourceLabel
} from './plugins';
import type { AvailablePluginView, PluginView } from './plugins';
import type { ServerSetting } from './settings';

/**
 * Builds one installed plugin entry.
 *
 * @param id The plugin id.
 * @param version The installed version.
 * @returns The plugin.
 */
function installed(id: string, version: string): PluginView {
  return {
    api: '1',
    enabled: true,
    id,
    installedAt: 1,
    isDefault: false,
    name: id,
    provides: [],
    requestedPermissions: [],
    source: 'official',
    state: 'enabled',
    version
  };
}

/**
 * Builds one offered plugin entry.
 *
 * @param id The plugin id.
 * @param version The offered version.
 * @returns The entry.
 */
function available(id: string, version: string): AvailablePluginView {
  return {
    description: '',
    homepage: '',
    id,
    isDefault: false,
    license: '',
    name: id,
    official: true,
    permissions: [],
    provides: [],
    verified: true,
    version
  };
}

/**
 * Builds one registered setting entry.
 *
 * @param key The dotted setting key.
 * @param value The effective value.
 * @returns The setting.
 */
function setting(key: string, value: unknown): ServerSetting {
  return {
    allowed: [],
    default: {},
    description: '',
    environmentPinned: false,
    key,
    kind: 'bool',
    pinned: false,
    source: 'database',
    userOverridable: false,
    value: value as ServerSetting['value']
  };
}

describe('plugin labels', () => {
  it('words every lifecycle state the server reports', () => {
    expect(pluginStateLabel('upgrade-pending-approval')).toBe('Upgrade waiting for review');
    expect(pluginStateLabel('enabled')).toBe('Enabled');
    expect(pluginStateLabel('disabled')).toBe('Disabled');
  });

  it('words the risk of a permission', () => {
    expect(riskLabel('low')).toBe('Low risk');
    expect(riskLabel('medium')).toBe('Medium risk');
    expect(riskLabel('high')).toBe('High risk');
  });

  it('words where a plugin came from', () => {
    expect(sourceLabel('official')).toBe('Official index');
    expect(sourceLabel('sideload')).toBe('Uploaded');
  });

  it('keeps a value it does not know readable', () => {
    expect(pluginStateLabel('quarantined')).toBe('quarantined');
    expect(riskLabel('extreme')).toBe('extreme');
    expect(sourceLabel('mirror')).toBe('mirror');
  });
});

describe('installable plugins', () => {
  it('leaves out an index entry this server already hosts at that version', () => {
    const offered = [available('app.one', '1.0.0'), available('app.two', '2.0.0')];

    expect(installablePlugins(offered, [installed('app.one', '1.0.0')])).toEqual([
      available('app.two', '2.0.0')
    ]);
  });

  it('keeps an entry at another version, which is an upgrade', () => {
    const offered = [available('app.one', '1.1.0')];

    expect(installablePlugins(offered, [installed('app.one', '1.0.0')])).toEqual(offered);
  });
});

describe('install confirmation', () => {
  it('asks when the server does not report the setting', () => {
    expect(confirmsInstall([])).toBe(true);
  });

  it('asks while the setting is on', () => {
    expect(confirmsInstall([setting('plugins.confirm_install', true)])).toBe(true);
  });

  it('skips the question once the setting is off', () => {
    expect(confirmsInstall([setting('plugins.confirm_install', false)])).toBe(false);
  });
});
