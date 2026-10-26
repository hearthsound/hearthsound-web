/**
 * The password rule the server enforces, mirrored by the client.
 *
 * The server refuses a password shorter than eight characters wherever it sets
 * one - the first administrator at setup, an administrator creating or resetting
 * an account, and the account's own change - so every form here refuses it
 * before sending, with the same sentence the server's problem carries. The rule
 * is the only one: there is no character-class demand, and an existing shorter
 * password keeps working because signing in never validates.
 *
 * `String#length` counts UTF-16 units where the server counts characters, so a
 * password of astral-plane characters could pass here and be refused there; the
 * server stays authoritative and the form shows its detail.
 */

/** The shortest password the server accepts. */
export const PASSWORD_MIN_LENGTH = 8;

/**
 * Checks a password against the server's length rule.
 *
 * @param password The password as typed.
 * @returns The sentence that explains what is wrong, or `null` when the server
 *   would accept it.
 */
export function passwordLengthProblem(password: string): string | null {
  return password.length < PASSWORD_MIN_LENGTH ? 'A password is at least 8 characters long.' : null;
}
