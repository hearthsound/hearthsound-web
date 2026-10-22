/**
 * The host settings and the slugs of a provider instance.
 *
 * An instance carries two configurations: the plugin's own server-scoped values
 * and the host's, which say where the instance may read and write and how many
 * calls it may run at once. The host settings are edited field by field here,
 * and a new instance is offered a slug derived from its plugin's id.
 */
import type { JsonSchema, UISchemaElement } from '@jsonforms/core';

import type { components } from '#lib/api/schema';
import { configObject } from '#lib/config-object';

import type { PluginView } from './plugins';

/** One configured provider instance. */
export type ProviderView = components['schemas']['ProviderView'];

/** An instance to configure. */
export type NewProvider = components['schemas']['NewProvider'];

/** The changes one instance edit sends. */
export type ProviderPatch = components['schemas']['ProviderPatch'];

/** One directory an instance may reach. */
export interface ImportRoot {
  /** The id the plugin names this root by. */
  id: string;
  /** The absolute directory of the root. */
  path: string;
  /** What happens to a file after it is imported: `move`, `copy` or `link`. */
  mode: string;
  /** Whether the root may only be read. */
  readOnly: boolean;
}

/** The host-level settings of one instance. */
export interface HostConfig {
  /** The directories the instance may reach. */
  importRoots: ImportRoot[];
  /** How many calls of the instance may run at once. */
  maxConcurrent: number;
  /** How many acquisition searches of the instance may run at once. */
  maxConcurrentSearches: number;
  /** How many acquisition searches the instance may start per hour. */
  searchesPerHour: number;
}

/** The modes an import root treats an imported file with. */
export const IMPORT_MODES: readonly string[] = ['move', 'copy', 'link'];

/** What each import mode is shown as. */
const IMPORT_MODE_LABELS: Record<string, string> = {
  move: 'Move',
  copy: 'Copy',
  link: 'Link'
};

/** The mode a new import root starts with; copying leaves the source in place. */
export const DEFAULT_IMPORT_MODE = 'copy';

/**
 * Returns the label of one import mode.
 *
 * @param mode The mode the server reported.
 * @returns The label, or the mode itself when it is one this client does not
 *   know.
 */
export function importModeLabel(mode: string): string {
  const label = IMPORT_MODE_LABELS[mode] as string | undefined;
  return typeof label === 'string' ? label : mode;
}

/**
 * Returns a new import root for the Files section.
 *
 * @returns An unnamed root that copies the files it imports, so adding one
 *   cannot take the source away before the administrator named it.
 */
export function newImportRoot(): ImportRoot {
  return { id: '', path: '', mode: DEFAULT_IMPORT_MODE, readOnly: false };
}

/** The host settings a new instance starts with. */
export const DEFAULT_HOST_CONFIG: HostConfig = {
  importRoots: [],
  maxConcurrent: 2,
  maxConcurrentSearches: 2,
  searchesPerHour: 120
};

/** A number in a configuration document, or the fallback when it is not one. */
function count(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback;
}

/**
 * Reads the import roots of a host configuration.
 *
 * @param value The value the instance reported.
 * @returns The roots, with the entries that are not roots left out.
 */
function importRoots(value: unknown): ImportRoot[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const roots: ImportRoot[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    // The server hands `Value` fields over as they are; this view reads the
    // fields an import root has and ignores the rest.
    const root = entry as Record<string, unknown>;
    roots.push({
      id: typeof root.id === 'string' ? root.id : '',
      path: typeof root.path === 'string' ? root.path : '',
      mode: typeof root.mode === 'string' ? root.mode : DEFAULT_IMPORT_MODE,
      readOnly: root.readOnly === true
    });
  }
  return roots;
}

/**
 * Reads the host settings of an instance.
 *
 * @param value The host configuration the server reported.
 * @returns The settings, with the host's defaults for everything the instance
 *   did not set.
 */
export function readHostConfig(value: unknown): HostConfig {
  if (typeof value !== 'object' || value === null) {
    return { ...DEFAULT_HOST_CONFIG, importRoots: [] };
  }
  // The fields of a `Value` are not described by the server's document.
  const config = value as Record<string, unknown>;
  return {
    importRoots: importRoots(config.importRoots),
    maxConcurrent: count(config.maxConcurrent, DEFAULT_HOST_CONFIG.maxConcurrent),
    maxConcurrentSearches: count(
      config.maxConcurrentSearches,
      DEFAULT_HOST_CONFIG.maxConcurrentSearches
    ),
    searchesPerHour: count(config.searchesPerHour, DEFAULT_HOST_CONFIG.searchesPerHour)
  };
}

/** The longest slug the server accepts. */
const MAX_SLUG_LENGTH = 24;

/** The shortest slug the server accepts. */
const MIN_SLUG_LENGTH = 2;

/**
 * Checks a slug against the rules the server enforces.
 *
 * The client repeats the rule so the dialog can say what is wrong before the
 * request; a slug is 2 to 24 lowercase letters and digits, and no other
 * instance may already hold it.
 *
 * @param slug The slug as typed.
 * @param taken The slugs the server already has.
 * @returns The sentence that explains what is wrong, or `null` when it is
 *   allowed.
 */
export function slugProblem(slug: string, taken: readonly string[] = []): string | null {
  if (slug.length < MIN_SLUG_LENGTH || slug.length > MAX_SLUG_LENGTH) {
    return `A slug is ${MIN_SLUG_LENGTH} to ${MAX_SLUG_LENGTH} characters long.`;
  }
  if (!/^[a-z0-9]+$/.test(slug)) {
    return 'A slug holds lowercase letters and digits only.';
  }
  if (taken.includes(slug)) {
    return 'That slug is already in use.';
  }
  return null;
}

/**
 * Returns the slug to offer for one plugin.
 *
 * @param pluginId The plugin id from its manifest, for example
 *   `app.hearthsound.slskd`.
 * @returns The last segment of the id, lowercased without anything that is not
 *   a letter or a digit, cut to the length a slug may have.
 */
export function defaultSlug(pluginId: string): string {
  const segment = pluginId.split('.').pop() ?? '';
  return segment
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, MAX_SLUG_LENGTH);
}

/**
 * Returns a slug no instance uses yet.
 *
 * @param slug The slug to start from.
 * @param taken The slugs the server already has.
 * @returns The slug itself when it is free, otherwise with the smallest number
 *   appended that makes it free, without growing past the length a slug may
 *   have.
 */
export function uniqueSlug(slug: string, taken: readonly string[]): string {
  if (!taken.includes(slug)) {
    return slug;
  }
  for (let suffix = 2; ; suffix += 1) {
    const text = String(suffix);
    const candidate = `${slug.slice(0, MAX_SLUG_LENGTH - text.length)}${text}`;
    if (!taken.includes(candidate)) {
      return candidate;
    }
  }
}

/** What the provider form edits. */
export interface ProviderFields {
  /** The installed plugin the instance is configured from. */
  pluginId: string;
  /** The instance slug, which the server accepts once. */
  slug: string;
  /** The name shown in the admin UI. */
  displayName: string;
  /** The plugin's server-scoped configuration. */
  serverConfig: unknown;
  /** The host-level settings: the import roots and the concurrency limits. */
  hostConfig: HostConfig;
}

/**
 * Returns the fields a new instance of one plugin starts with.
 *
 * @param plugin The installed plugin to configure.
 * @param takenSlugs The slugs the server already has.
 * @returns The fields, named after the plugin and slugged after its id.
 */
export function pluginFields(plugin: PluginView, takenSlugs: readonly string[]): ProviderFields {
  return {
    pluginId: plugin.id,
    slug: uniqueSlug(defaultSlug(plugin.id), takenSlugs),
    displayName: plugin.name,
    serverConfig: {},
    hostConfig: { ...DEFAULT_HOST_CONFIG, importRoots: [] }
  };
}

/**
 * Returns the fields of one configured instance.
 *
 * @param provider The instance to edit.
 * @returns The fields the form opens it with.
 */
export function instanceFields(provider: ProviderView): ProviderFields {
  return {
    pluginId: provider.pluginId,
    slug: provider.slug,
    displayName: provider.displayName,
    serverConfig: provider.serverConfig,
    hostConfig: readHostConfig(provider.hostConfig)
  };
}

/**
 * Returns the body that creates the instance the form describes.
 *
 * @param fields The form's fields.
 * @returns The body of the create request.
 */
export function newProviderBody(fields: ProviderFields): NewProvider {
  const displayName = fields.displayName.trim();
  return {
    pluginId: fields.pluginId,
    slug: fields.slug.trim(),
    displayName: displayName === '' ? null : displayName,
    serverConfig: configObject(fields.serverConfig),
    hostConfig: configObject(fields.hostConfig)
  };
}

/**
 * Returns the changes one instance edit sends.
 *
 * The slug and the plugin are not mutable and are left out; an empty display
 * name is left out too, so the instance keeps the name it has.
 *
 * @param fields The form's fields.
 * @returns The body of the patch request.
 */
export function providerPatchBody(fields: ProviderFields): ProviderPatch {
  const body: ProviderPatch = {
    serverConfig: configObject(fields.serverConfig),
    hostConfig: configObject(fields.hostConfig)
  };
  const displayName = fields.displayName.trim();
  if (displayName !== '') {
    body.displayName = displayName;
  }
  return body;
}

/** The configuration form a plugin's manifest declares. */
export interface FormConfig {
  /** The draft-07 JSON Schema of the configuration object. */
  schema: JsonSchema;
  /** The UI schema that lays the form out, or `null` to lay it out by itself. */
  uischema: UISchemaElement | null;
}

/**
 * Adapts the configuration a plugin view carries to the form.
 *
 * @param config The configuration section of the plugin's manifest.
 * @returns The schema and the layout to render, or `null` when the manifest
 *   declares no server-scoped configuration.
 */
export function formConfig(
  config: { schema: unknown; uiSchema: unknown } | null | undefined
): FormConfig | null {
  if (config === null || config === undefined) {
    return null;
  }
  return {
    schema: config.schema as unknown as JsonSchema,
    uischema:
      config.uiSchema === null || config.uiSchema === undefined
        ? null
        : (config.uiSchema as unknown as UISchemaElement)
  };
}
