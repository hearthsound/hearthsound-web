/**
 * Changing the account's own password.
 *
 * The current password is presented with the new one, so a stolen session
 * cannot lock the owner out. A successful change ends every other session of
 * the account and revokes every API key and app password of it; the session
 * that made it keeps working.
 *
 * The failure arm keeps the problem's `code` beside the sentence, because two
 * codes need different handling: `wrong-password` marks the current field
 * rather than signing the reader out, and `rate-limited` carries the wait in the
 * server's detail.
 */
import { nativeClient } from '#lib/api/native';
import { problemMessage } from '#lib/admin/problem';

/** The answer of a password change. */
export type PasswordResult = { ok: true } | { ok: false; message: string; code: string | null };

/**
 * Changes the caller's password.
 *
 * @param currentPassword The password the account has now.
 * @param newPassword The password to store.
 * @returns Nothing, or the refusal with the problem's code.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<PasswordResult> {
  try {
    const answer = await nativeClient.POST('/api/v1/me/password', {
      body: { currentPassword, newPassword }
    });
    if (answer.response.status === 204) {
      return { ok: true };
    }
    return {
      ok: false,
      message: problemMessage(answer.error, 'Could not change the password.'),
      code: answer.error?.code ?? null
    };
  } catch {
    return {
      ok: false,
      message: 'Could not change this password.',
      code: null
    };
  }
}
