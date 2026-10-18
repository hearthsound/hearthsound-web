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
  'pending-approval': 'Waiting for approval',
  'upgrade-pending-approval': 'Upgrade waiting for approval',
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
