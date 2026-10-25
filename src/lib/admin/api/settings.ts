/**
 * The server setting endpoints the admin views call.
 *
 * A patch answers with every setting after the change, which is what the rows
 * adopt, so a page never has to merge one setting into its list itself. Both
 * calls answer through {@link guard}, so a request that never reached the
 * server is a refused answer rather than a thrown rejection.
 */
import { nativeClient } from '#lib/api/native';

import { guard, refused, okay } from './result';
import type { AdminResult } from './result';
import type { ServerSetting, ServerSettingsPatch } from '../settings';

/**
 * Reads every registered setting.
 *
 * @returns The settings, in registry order.
 */
export async function listSettings(): Promise<AdminResult<ServerSetting[]>> {
  return guard(async () => {
    const answer = await nativeClient.GET('/api/v1/admin/settings');
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not load the settings.', answer.response.status);
    }
    return okay(answer.data.settings);
  });
}

/**
 * Stores a batch of setting changes.
 *
 * @param body The changes to send.
 * @returns Every setting as it is after the change.
 */
export async function saveSettings(
  body: ServerSettingsPatch
): Promise<AdminResult<ServerSetting[]>> {
  return guard(async () => {
    const answer = await nativeClient.PATCH('/api/v1/admin/settings', { body });
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not save the setting.', answer.response.status);
    }
    return okay(answer.data.settings);
  });
}
