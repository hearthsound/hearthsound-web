/**
 * The listening-service links of the signed-in account.
 *
 * Every service the server offers answers with its link state, its layers and
 * the delivery state of the scrobbles waiting for it; linking happens either
 * with the user configuration the plugin declares or through the service's own
 * site. The page never calls the native client itself, so a test can replace
 * one call without knowing which route it is written against.
 */
import type { components } from '#lib/api/schema';
import { nativeClient } from '#lib/api/native';
import { problemMessage } from '#lib/admin/problem';

/** One service the listener may link, as the server reports it. */
export type ProviderLink = components['schemas']['ProviderLink'];

/** The answer of one link call. */
export type LinkResult<T> = { ok: true; value: T } | { ok: false; message: string };

/**
 * Reads the services the caller may link.
 *
 * @returns The services, in the server's slug order.
 */
export async function listServices(): Promise<LinkResult<ProviderLink[]>> {
  const answer = await nativeClient.GET('/api/v1/me/providers');
  if (answer.data === undefined) {
    return { ok: false, message: problemMessage(answer.error, 'Could not load the services.') };
  }
  return { ok: true, value: answer.data.providers };
}

/**
 * Stores the caller's configuration for one service.
 *
 * The server checks the configuration against the plugin's schema and asks the
 * plugin to name the account, so a refused save carries the plugin's own words
 * in the problem detail.
 *
 * @param slug The service's slug.
 * @param config The configuration the form holds.
 * @returns The service as it is now.
 */
export async function saveServiceConfig(
  slug: string,
  config: Record<string, unknown>
): Promise<LinkResult<ProviderLink>> {
  const answer = await nativeClient.PUT('/api/v1/me/providers/{slug}/config', {
    params: { path: { slug } },
    // The document models the free-form object as `{}`, which the generator
    // types without a value shape.
    body: { config: config as never }
  });
  if (answer.data === undefined) {
    return { ok: false, message: problemMessage(answer.error, 'Could not save the service.') };
  }
  return { ok: true, value: answer.data };
}

/**
 * Starts a browser link and answers the address to open.
 *
 * @param slug The service's slug.
 * @returns The service's authorization page.
 */
export async function beginServiceLink(slug: string): Promise<LinkResult<string>> {
  const answer = await nativeClient.POST('/api/v1/me/providers/{slug}/link', {
    params: { path: { slug } }
  });
  if (answer.data === undefined) {
    return { ok: false, message: problemMessage(answer.error, 'Could not connect the service.') };
  }
  return { ok: true, value: answer.data.url };
}

/**
 * Removes the caller's link to one service.
 *
 * @param slug The service's slug.
 * @returns Nothing.
 */
export async function unlinkService(slug: string): Promise<LinkResult<void>> {
  const answer = await nativeClient.DELETE('/api/v1/me/providers/{slug}/link', {
    params: { path: { slug } }
  });
  if (answer.response.status !== 204) {
    return {
      ok: false,
      message: problemMessage(answer.error, 'Could not disconnect the service.')
    };
  }
  return { ok: true, value: undefined };
}

/**
 * Sends the browser to the service's authorization page.
 *
 * Kept apart from the page so the browser flow can be observed without
 * navigating the test window.
 *
 * @param url The address the server answered with.
 * @returns Nothing.
 */
export function openExternal(url: string): void {
  window.location.assign(url);
}
