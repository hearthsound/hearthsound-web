/**
 * The plugin endpoints the admin view and the setup wizard call.
 *
 * Installing a plugin grants the permissions its manifest requests and enables
 * it. The approve endpoint only applies an upgrade the server staged because it
 * asks for permissions the installed version does not hold.
 */
import type { components } from '#lib/api/schema';
import { nativeClient } from '#lib/api/native';

import { refused, okay, settled } from './result';
import type { AdminResult } from './result';
import type { AvailablePluginView, PluginView, RepositoryView } from '../plugins';

/** The body that registers a repository. */
type NewRepository = components['schemas']['NewRepository'];

/** The changes one repository edit sends. */
type RepositoryPatch = components['schemas']['RepositoryPatch'];

/** What the indexes offer, and the indexes that could not be read. */
export interface AvailablePlugins {
  /** One entry per plugin an index offers. */
  plugins: AvailablePluginView[];
  /** One line per index that could not be read. */
  errors: string[];
}

/**
 * Reads the installed plugins.
 *
 * @returns The plugins, in the order the server lists them.
 */
export async function listPlugins(): Promise<AdminResult<PluginView[]>> {
  const answer = await nativeClient.GET('/api/v1/admin/plugins');
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not load the plugins.');
  }
  return okay(answer.data.plugins);
}

/**
 * Reads the plugins the reachable indexes offer.
 *
 * @returns The offered plugins and the index failures.
 */
export async function listAvailablePlugins(): Promise<AdminResult<AvailablePlugins>> {
  const answer = await nativeClient.GET('/api/v1/admin/plugins/available');
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not load the plugins.');
  }
  return okay({
    plugins: answer.data.plugins,
    errors: answer.data.errors.map((error) => `${error.source}: ${error.detail}`)
  });
}

/**
 * Reads the registered plugin repositories.
 *
 * @returns The repositories, in the order the server lists them.
 */
export async function listRepositories(): Promise<AdminResult<RepositoryView[]>> {
  const answer = await nativeClient.GET('/api/v1/admin/plugin-repositories');
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not load the plugins.');
  }
  return okay(answer.data.repositories);
}

/**
 * Installs one plugin an index offers.
 *
 * The install grants the permissions the manifest requests and enables the
 * plugin. It replaces an installed version unless the new one asks for more
 * than the installed grant holds, in which case the server stages the upgrade
 * for review.
 *
 * @param pluginId The plugin id from the index.
 * @param repositoryId The index that offers it, or `null` when the server
 *   should choose one.
 * @returns The installed plugin, or the refusal.
 */
export async function installPlugin(
  pluginId: string,
  repositoryId: string | null
): Promise<AdminResult<PluginView>> {
  const answer = await nativeClient.POST('/api/v1/admin/plugins', {
    body:
      repositoryId === null
        ? { source: 'index', pluginId }
        : { source: 'index', pluginId, repositoryId }
  });
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not install the plugin.');
  }
  return okay(answer.data);
}

/**
 * Installs the plugin archive a reader chose.
 *
 * @param file The archive to install.
 * @returns The installed plugin, or the refusal.
 */
export async function installPluginArchive(file: File): Promise<AdminResult<PluginView>> {
  const body = new FormData();
  body.append('file', file);
  const answer = await nativeClient.POST('/api/v1/admin/plugins/upload', { body });
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not install the file.');
  }
  return okay(answer.data);
}

/**
 * Applies the staged upgrade of one plugin.
 *
 * @param id The plugin's id.
 * @returns The plugin as it is now.
 */
export async function applyPluginUpgrade(id: string): Promise<AdminResult<PluginView>> {
  return pluginCommand(id, 'approve', 'Could not apply the upgrade.');
}

/**
 * Discards the staged upgrade of one plugin.
 *
 * @param id The plugin's id.
 * @returns The plugin as it is now.
 */
export async function declinePluginUpgrade(id: string): Promise<AdminResult<PluginView>> {
  return pluginCommand(id, 'decline-upgrade', 'Could not decline the upgrade.');
}

/**
 * Enables or disables one plugin.
 *
 * @param id The plugin's id.
 * @param enabled Whether the plugin should serve.
 * @returns The plugin as it is now.
 */
export async function setPluginEnabled(
  id: string,
  enabled: boolean
): Promise<AdminResult<PluginView>> {
  return pluginCommand(
    id,
    enabled ? 'enable' : 'disable',
    enabled ? 'Could not enable the plugin.' : 'Could not disable the plugin.'
  );
}

/**
 * Removes one plugin and everything it was granted.
 *
 * @param id The plugin's id.
 * @returns Nothing, or the refusal.
 */
export async function removePlugin(id: string): Promise<AdminResult<void>> {
  const answer = await nativeClient.DELETE('/api/v1/admin/plugins/{id}', {
    params: { path: { id } }
  });
  return settled(answer.response.status, answer.error, 'Could not remove the plugin.');
}

/**
 * Registers a repository from the Add Plugins dialog.
 *
 * @param body The repository's URL, name and public key.
 * @returns The repository the server answered with.
 */
export async function registerRepository(
  body: NewRepository
): Promise<AdminResult<RepositoryView>> {
  const answer = await nativeClient.POST('/api/v1/admin/plugin-repositories', { body });
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not save the repository.');
  }
  return okay(answer.data);
}

/**
 * Changes the name, key or enabled state of one repository.
 *
 * @param id The repository's id.
 * @param body The changes to send.
 * @returns The repository as it is now.
 */
export async function updateRepository(
  id: string,
  body: RepositoryPatch
): Promise<AdminResult<RepositoryView>> {
  const answer = await nativeClient.PATCH('/api/v1/admin/plugin-repositories/{id}', {
    params: { path: { id } },
    body
  });
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not save the repository.');
  }
  return okay(answer.data);
}

/**
 * Removes one repository.
 *
 * @param id The repository's id.
 * @returns Nothing, or the refusal.
 */
export async function removeRepository(id: string): Promise<AdminResult<void>> {
  const answer = await nativeClient.DELETE('/api/v1/admin/plugin-repositories/{id}', {
    params: { path: { id } }
  });
  return settled(answer.response.status, answer.error, 'Could not remove the repository.');
}

/** The command endpoints that answer with the changed plugin. */
const COMMANDS = {
  approve: '/api/v1/admin/plugins/{id}/approve',
  'decline-upgrade': '/api/v1/admin/plugins/{id}/decline-upgrade',
  enable: '/api/v1/admin/plugins/{id}/enable',
  disable: '/api/v1/admin/plugins/{id}/disable'
} as const;

/**
 * Runs one plugin command that answers with the changed plugin.
 *
 * @param id The plugin's id.
 * @param command The command's path segment.
 * @param fallback The sentence to show when the server did not answer.
 * @returns The plugin as it is now.
 */
async function pluginCommand(
  id: string,
  command: keyof typeof COMMANDS,
  fallback: string
): Promise<AdminResult<PluginView>> {
  const answer = await nativeClient.POST(COMMANDS[command], {
    params: { path: { id } }
  });
  if (answer.data === undefined) {
    return refused(answer.error, fallback);
  }
  return okay(answer.data);
}
