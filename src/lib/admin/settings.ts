/**
 * The server settings the admin views edit.
 *
 * A setting arrives with the shape its value has, where the value comes from,
 * and whether the configuration file or the environment pins it. The editors
 * map that value to the text a field holds and back, so a value that was not
 * touched is stored as it was and a cleared field removes the stored value so
 * the layers below apply again.
 */
import type { components } from '#lib/api/schema';
import { formatStringList, parseNumber, parseStringList } from '#lib/jsonforms/value';

import { configObject } from './providers';

/** One registered server setting. */
export type ServerSetting = components['schemas']['ServerSetting'];

/** A batch of server setting changes. */
export type ServerSettingsPatch = components['schemas']['ServerSettingsPatch'];

/** One group of settings: the first segment of the keys it holds. */
export interface SettingGroup {
  /** The first segment of the keys, for example `storage`. */
  segment: string;
  /** The settings, in the order the server listed them. */
  settings: ServerSetting[];
}

/**
 * The keys the settings page never shows.
 *
 * `server.base_url` is bootstrap-only: it is read before the server can be
 * addressed through the web client, so a stored value would not change it
 * (copy.md section 10.9a).
 */
const BOOTSTRAP_KEYS: Readonly<Record<string, true>> = { 'server.base_url': true };

/**
 * Returns the settings the page shows.
 *
 * @param settings Every registered setting, in registry order.
 * @returns The settings that are not bootstrap-only.
 */
export function visibleSettings(settings: readonly ServerSetting[]): ServerSetting[] {
  return settings.filter((setting) => BOOTSTRAP_KEYS[setting.key] !== true);
}

/**
 * Groups settings by the first segment of their key.
 *
 * @param settings Every registered setting, in registry order.
 * @returns One group per segment, in the order the segments first appear.
 */
export function groupSettings(settings: readonly ServerSetting[]): SettingGroup[] {
  const groups: SettingGroup[] = [];
  for (const setting of settings) {
    const segment = setting.key.split('.')[0] ?? setting.key;
    const group = groups.find((candidate) => candidate.segment === segment);
    if (group === undefined) {
      groups.push({ segment, settings: [setting] });
    } else {
      group.settings.push(setting);
    }
  }
  return groups;
}

/**
 * Returns the text an editor holds for one setting's value.
 *
 * A list of strings is written one item per line, a boolean as `true` or
 * `false`, and a value the setting does not have as nothing.
 *
 * @param setting The setting to edit.
 * @returns The text of the field.
 */
export function settingText(setting: ServerSetting): string {
  const value: unknown = setting.value;
  if (setting.kind === 'stringList') {
    return formatStringList(value);
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

/**
 * Returns the value an editor's text stands for.
 *
 * An empty field stands for `null`, which removes the stored value; a number
 * field the administrator filled with something that is not a number is treated
 * the same way, because the server would refuse it.
 *
 * @param kind The value's shape: `bool`, `integer`, `float`, `string` or
 *   `stringList`.
 * @param text The value of the field, which a number input reports as a number
 *   once it is edited and as text before that.
 * @returns The value to store, or `null` to remove the stored one.
 */
export function settingValue(kind: string, text: unknown): unknown {
  if (kind === 'stringList') {
    const items = parseStringList(typeof text === 'string' ? text : '');
    return items.length === 0 ? null : items;
  }
  if (kind === 'bool') {
    return text === true || text === 'true';
  }
  if (kind === 'integer' || kind === 'float') {
    const value =
      typeof text === 'number' ? text : typeof text === 'string' ? parseNumber(text) : undefined;
    if (value === undefined || !Number.isFinite(value)) {
      return null;
    }
    return kind === 'integer' ? Math.trunc(value) : value;
  }
  return typeof text === 'string' && text.trim() !== '' ? text : null;
}

/**
 * Returns the body that stores one setting's value.
 *
 * @param key The dotted setting key.
 * @param value The value to store, or `null` to remove the stored one.
 * @returns The body of the patch request.
 */
export function settingPatch(key: string, value: unknown): ServerSettingsPatch {
  return { settings: configObject({ [key]: value }) };
}
