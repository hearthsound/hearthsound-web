/**
 * The provider instance endpoints the admin views and the setup wizard call.
 *
 * An instance is patched by its slug, which is fixed once created; the health
 * check answers with the report the instance's row then shows.
 */
import type { components } from '#lib/api/schema';
import { nativeClient } from '#lib/api/native';

import { refused, okay, settled } from './result';
import type { AdminResult } from './result';
import type { NewProvider, ProviderPatch, ProviderView } from '../providers';

/** The report one health check answers with. */
export type HealthView = components['schemas']['HealthView'];

/**
 * Reads every configured instance.
 *
 * @returns The instances, in the order the server lists them.
 */
export async function listProviders(): Promise<AdminResult<ProviderView[]>> {
  const answer = await nativeClient.GET('/api/v1/admin/providers');
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not load the instances.');
  }
  return okay(answer.data.providers);
}

/**
 * Runs the health check of one instance.
 *
 * @param slug The instance's slug.
 * @param fallback The sentence to show when the server did not answer.
 * @returns The report, which the row shows until the next check.
 */
export async function checkProviderHealth(
  slug: string,
  fallback = 'Could not check the instance.'
): Promise<AdminResult<HealthView>> {
  const answer = await nativeClient.GET('/api/v1/admin/providers/{slug}/health', {
    params: { path: { slug } }
  });
  if (answer.data === undefined) {
    return refused(answer.error, fallback);
  }
  return okay(answer.data);
}

/**
 * Configures one instance from an installed plugin.
 *
 * @param body The instance to create.
 * @returns The instance the server answered with.
 */
export async function createProvider(body: NewProvider): Promise<AdminResult<ProviderView>> {
  const answer = await nativeClient.POST('/api/v1/admin/providers', { body });
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not save the instance.');
  }
  return okay(answer.data);
}

/**
 * Replaces the configuration of one instance.
 *
 * @param slug The instance's slug.
 * @param body The changes to send.
 * @returns The instance as it is now.
 */
export async function updateProvider(
  slug: string,
  body: ProviderPatch
): Promise<AdminResult<ProviderView>> {
  const answer = await nativeClient.PATCH('/api/v1/admin/providers/{slug}', {
    params: { path: { slug } },
    body
  });
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not save the instance.');
  }
  return okay(answer.data);
}

/**
 * Removes one instance.
 *
 * @param slug The instance's slug.
 * @returns Nothing, or the refusal.
 */
export async function deleteProvider(slug: string): Promise<AdminResult<void>> {
  const answer = await nativeClient.DELETE('/api/v1/admin/providers/{slug}', {
    params: { path: { slug } }
  });
  return settled(answer.response.status, answer.error, 'Could not remove the instance.');
}
