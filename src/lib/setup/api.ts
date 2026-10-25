/**
 * The first-run setup endpoints the wizard calls.
 *
 * The status read says whether the server still waits for its first
 * administrator, and the setup link's one-time token creates that account. The
 * wizard is reachable before anyone exists, so neither call is an admin call;
 * they share the admin facades' result shape and their {@link guard}, so every
 * caller checks one kind of answer and one module words the failure.
 */
import type { components } from '#lib/api/schema';
import { nativeClient } from '#lib/api/native';

import { guard, refused, okay } from '../admin/api/result';
import type { AdminResult } from '../admin/api/result';

/** Whether the server still needs its first administrator. */
export type SetupStatus = components['schemas']['SetupStatus'];

/** The administrator the first setup creates. */
export type SetupRequest = components['schemas']['SetupRequest'];

/** The session the server starts for the administrator it created. */
export type StartedSession = components['schemas']['LoginResponse'];

/**
 * Reads whether the server still needs its first administrator.
 *
 * @returns The status, or the refusal.
 */
export async function getSetupStatus(): Promise<AdminResult<SetupStatus>> {
  return guard(async () => {
    const answer = await nativeClient.GET('/api/v1/setup');
    if (answer.data === undefined) {
      return refused(
        answer.error,
        'Could not read what this server needs.',
        answer.response.status
      );
    }
    return okay(answer.data);
  });
}

/**
 * Creates the first administrator from the setup link.
 *
 * @param body The one-time token and the account to create.
 * @returns The session the server started, or the refusal.
 */
export async function completeSetup(body: SetupRequest): Promise<AdminResult<StartedSession>> {
  return guard(async () => {
    const answer = await nativeClient.POST('/api/v1/setup', { body });
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not create the administrator.', answer.response.status);
    }
    return okay(answer.data);
  });
}
