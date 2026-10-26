/**
 * The API keys and app passwords of the signed-in account.
 *
 * Both are the same shape of credential: a name, the moment it was created and
 * the last time it authenticated; an API key additionally reports the prefix of
 * its secret, which is all the server keeps after the one answer that carries
 * the secret itself. The page never calls the native client directly, so a test
 * can replace one call; every call answers {@link CredentialResult}, including a
 * request the network refused, so a dialog's busy state never depends on a
 * thrown rejection.
 */
import type { components } from '#lib/api/schema';
import { nativeClient } from '#lib/api/native';
import { problemMessage } from '#lib/admin/problem';

/** One API key, as the listing shows it. */
export type ApiKeyView = components['schemas']['ApiKeyView'];

/** One app password, as the listing shows it. */
export type AppPasswordView = components['schemas']['AppPasswordView'];

/** An API key that was just created, with the secret the server shows once. */
export type CreatedApiKey = components['schemas']['CreatedApiKey'];

/** An app password that was just created, with the secret the server shows once. */
export type CreatedAppPassword = components['schemas']['CreatedAppPassword'];

/** The kind of credential a dialog creates. */
export type CredentialKind = 'apiKey' | 'appPassword';

/** The answer of one credential call. */
export type CredentialResult<T> = { ok: true; value: T } | { ok: false; message: string };

/** The longest name the server accepts, in characters. */
export const CREDENTIAL_NAME_MAX_LENGTH = 64;

/**
 * Checks the name a new credential is listed under.
 *
 * @param name The name as typed.
 * @returns The sentence that explains what is wrong, or `null` when the server
 *   would accept it.
 */
export function credentialNameProblem(name: string): string | null {
  if (name === '') {
    return 'Choose a name.';
  }
  return name.length > CREDENTIAL_NAME_MAX_LENGTH
    ? 'A credential name is at most 64 characters long.'
    : null;
}

/**
 * Describes when a credential last authenticated.
 *
 * @param value The unix millisecond timestamp the server reported, if any.
 * @returns The sentence the row shows.
 */
export function lastUsedText(value?: number | null): string {
  return value === undefined || value === null
    ? 'Never used'
    : `Last used ${new Date(value).toLocaleDateString()}`;
}

/**
 * Describes when a credential was created.
 *
 * @param value The unix millisecond timestamp the server reported.
 * @returns The sentence the row shows.
 */
export function createdText(value: number): string {
  return `Created ${new Date(value).toLocaleDateString()}`;
}

/**
 * Reads the caller's API keys.
 *
 * @returns The keys, newest first, or the refusal.
 */
export async function listApiKeys(): Promise<CredentialResult<ApiKeyView[]>> {
  try {
    const answer = await nativeClient.GET('/api/v1/me/api-keys');
    if (answer.data === undefined) {
      return { ok: false, message: problemMessage(answer.error, 'Could not load the API keys.') };
    }
    return { ok: true, value: answer.data };
  } catch {
    return { ok: false, message: 'Could not read the API keys.' };
  }
}

/**
 * Creates an API key for the caller.
 *
 * @param name What the key is for.
 * @returns The key with its secret, which the server never shows again, or the
 *   refusal.
 */
export async function createApiKey(name: string): Promise<CredentialResult<CreatedApiKey>> {
  try {
    const answer = await nativeClient.POST('/api/v1/me/api-keys', { body: { name } });
    if (answer.data === undefined) {
      return { ok: false, message: problemMessage(answer.error, 'Could not create the API key.') };
    }
    return { ok: true, value: answer.data };
  } catch {
    return { ok: false, message: 'Could not create this API key.' };
  }
}

/**
 * Revokes one of the caller's API keys.
 *
 * @param id The key's client id.
 * @returns Nothing, or the refusal.
 */
export async function revokeApiKey(id: string): Promise<CredentialResult<void>> {
  try {
    const answer = await nativeClient.DELETE('/api/v1/me/api-keys/{id}', {
      params: { path: { id } }
    });
    if (answer.response.status === 204) {
      return { ok: true, value: undefined };
    }
    return { ok: false, message: problemMessage(answer.error, 'Could not revoke the API key.') };
  } catch {
    return { ok: false, message: 'Could not revoke this API key.' };
  }
}

/**
 * Reads the caller's app passwords.
 *
 * @returns The app passwords, newest first, or the refusal.
 */
export async function listAppPasswords(): Promise<CredentialResult<AppPasswordView[]>> {
  try {
    const answer = await nativeClient.GET('/api/v1/me/app-passwords');
    if (answer.data === undefined) {
      return {
        ok: false,
        message: problemMessage(answer.error, 'Could not load the app passwords.')
      };
    }
    return { ok: true, value: answer.data };
  } catch {
    return { ok: false, message: 'Could not read the app passwords.' };
  }
}

/**
 * Creates an app password for the caller.
 *
 * @param name What the app password is for.
 * @returns The app password with its secret, which the server never shows again,
 *   or the refusal.
 */
export async function createAppPassword(
  name: string
): Promise<CredentialResult<CreatedAppPassword>> {
  try {
    const answer = await nativeClient.POST('/api/v1/me/app-passwords', { body: { name } });
    if (answer.data === undefined) {
      return {
        ok: false,
        message: problemMessage(answer.error, 'Could not create the app password.')
      };
    }
    return { ok: true, value: answer.data };
  } catch {
    return { ok: false, message: 'Could not create this app password.' };
  }
}

/**
 * Revokes one of the caller's app passwords.
 *
 * @param id The app password's client id.
 * @returns Nothing, or the refusal.
 */
export async function revokeAppPassword(id: string): Promise<CredentialResult<void>> {
  try {
    const answer = await nativeClient.DELETE('/api/v1/me/app-passwords/{id}', {
      params: { path: { id } }
    });
    if (answer.response.status === 204) {
      return { ok: true, value: undefined };
    }
    return {
      ok: false,
      message: problemMessage(answer.error, 'Could not revoke the app password.')
    };
  } catch {
    return { ok: false, message: 'Could not revoke this app password.' };
  }
}

/**
 * Names the credential a dialog creates.
 *
 * @param kind The kind of credential.
 * @returns The title of the dialog, the button that creates it and the answer's
 *   dialog title.
 */
export function credentialLabels(kind: CredentialKind): {
  /** The title of the entry dialog. */
  create: string;
  /** The title of the dialog that shows the secret. */
  created: string;
} {
  return kind === 'apiKey'
    ? { create: 'Create API Key', created: 'API Key Created' }
    : { create: 'Create App Password', created: 'App Password Created' };
}
