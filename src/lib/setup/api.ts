/**
 * The first-run setup endpoints the wizard calls.
 *
 * The status read says whether the server still waits for its first
 * administrator, a token check says whether the link the browser opened is the
 * live one, and the setup link's one-time token creates that account. The
 * wizard is reachable before anyone exists, so none of the calls is an admin
 * call; the two that answer a value share the admin facades' result shape and
 * their {@link guard}, so every caller checks one kind of answer and one module
 * words the failure.
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
 * What the pre-flight check of a setup link answered.
 *
 * `unknown` is every answer that is neither a live link nor a wrong one - the
 * server was unreachable, or setup finished meanwhile - so the wizard keeps its
 * ordinary behaviour instead of locking a form that may still work.
 */
export type SetupTokenState = 'valid' | 'invalid' | 'unknown';

/**
 * Asks the server whether a setup link is still the live one.
 *
 * The check never spends the link: the same token still creates the
 * administrator afterwards. It is charged to the client's address exactly like
 * a setup attempt, so a link cannot be walked through it.
 *
 * @param token The token the link carried.
 * @returns Whether the link is live, wrong, or the answer did not say.
 */
export async function checkSetupToken(token: string): Promise<SetupTokenState> {
  try {
    const answer = await nativeClient.POST('/api/v1/setup/check', { body: { token } });
    if (answer.response.status === 204) {
      return 'valid';
    }
    if (answer.response.status === 403) {
      return 'invalid';
    }
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

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
