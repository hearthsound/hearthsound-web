/**
 * The words the plugin views show.
 *
 * A plugin reports its lifecycle state, the risk of each permission it asks for
 * and where it came from as short machine-readable values; the views show them
 * as sentences while keeping a value they do not know yet readable.
 */
import type { components } from '#lib/api/schema';

/** One installed plugin, as an administrator sees it. */
export type PluginView = components['schemas']['PluginView'];

/** One plugin an index offers. */
export type AvailablePluginView = components['schemas']['AvailablePluginView'];

/** One permission a plugin asks for. */
export type PermissionView = components['schemas']['PermissionView'];

/** One registered plugin repository. */
export type RepositoryView = components['schemas']['RepositoryView'];

/** What each lifecycle state is shown as. */
const STATE_LABELS: Record<string, string> = {
  'upgrade-pending-approval': 'Upgrade waiting for review',
  disabled: 'Disabled',
  enabled: 'Enabled'
};

/** What each risk a permission carries is shown as. */
const RISK_LABELS: Record<string, string> = {
  low: 'Low risk',
  medium: 'Medium risk',
  high: 'High risk'
};

/** What each source a plugin came from is shown as. */
const SOURCE_LABELS: Record<string, string> = {
  official: 'Official index',
  repository: 'Repository',
  sideload: 'Uploaded',
  bundled: 'Bundled'
};

/**
 * Returns the plugins an index offers that this server does not already host
 * at the same version.
 *
 * An entry whose id is installed at another version stays: installing it
 * upgrades the plugin. An id installed at the offered version cannot be
 * installed again, so its Install button would only repeat an answer the
 * server already gave.
 *
 * @param available The plugins the reachable indexes offer.
 * @param installed The plugins this server hosts.
 * @returns The installable entries, in the order the indexes listed them.
 */
export function installablePlugins(
  available: readonly AvailablePluginView[],
  installed: readonly PluginView[]
): AvailablePluginView[] {
  const hosted = new Map(installed.map((plugin) => [plugin.id, plugin.version]));
  return available.filter((entry) => hosted.get(entry.id) !== entry.version);
}

/**
 * Returns the label of one lifecycle state.
 *
 * @param state The state the server reported.
 * @returns The label, or the state itself when it is one this client does not
 *   know.
 */
export function pluginStateLabel(state: string): string {
  const label = STATE_LABELS[state] as string | undefined;
  return typeof label === 'string' ? label : state;
}

/**
 * Returns the label of one permission's risk.
 *
 * @param risk The risk the manifest declared.
 * @returns The label, or the risk itself when it is one this client does not
 *   know.
 */
export function riskLabel(risk: string): string {
  const label = RISK_LABELS[risk] as string | undefined;
  return typeof label === 'string' ? label : risk;
}

/**
 * Returns the label of where a plugin came from.
 *
 * @param source The source the server reported.
 * @returns The label, or the source itself when it is one this client does not
 *   know.
 */
export function sourceLabel(source: string): string {
  const label = SOURCE_LABELS[source] as string | undefined;
  return typeof label === 'string' ? label : source;
}
