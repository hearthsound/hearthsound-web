/**
 * The password rule every form and the client mirror.
 */
import { describe, expect, it } from 'vitest';

import { PASSWORD_MIN_LENGTH, passwordLengthProblem } from './password';

describe('the password rule', () => {
  it('is the length the server enforces', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
  });

  it('refuses a password under the length', () => {
    expect(passwordLengthProblem('')).toBe('A password is at least 8 characters long.');
    expect(passwordLengthProblem('short12')).toBe('A password is at least 8 characters long.');
  });

  it('accepts a password of exactly the length, and a longer one', () => {
    expect(passwordLengthProblem('long-enough')).toBeNull();
    expect(passwordLengthProblem('x'.repeat(64))).toBeNull();
  });
});
