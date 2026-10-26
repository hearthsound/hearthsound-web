/**
 * Tests for the account fields the admin view maps to the native API bodies.
 */
import { describe, expect, it } from 'vitest';

import {
  emptyUserFields,
  isDisabled,
  newUserBody,
  newPasswordProblem,
  permissionsText,
  quotaOfFields,
  quotaText,
  userFields,
  userPatchBody,
  userSummary,
  usernameProblem
} from './users';
import type { AdminUser } from './users';

/** An account with a quota and two permissions. */
const user: AdminUser = {
  id: 'us_1',
  username: 'ada',
  displayName: 'Ada',
  isAdmin: true,
  disabledAt: null,
  createdAt: 1,
  updatedAt: 2,
  permissions: { acquire: true, download: false, upload: true },
  quota: { acquisitionsPerDay: 5, acquisitionBytesPerDay: 20 * 1024 ** 3 }
};

describe('account fields', () => {
  it('reads an account into the fields of the edit dialog', () => {
    expect(userFields(user)).toEqual({
      username: 'ada',
      displayName: 'Ada',
      password: '',
      isAdmin: true,
      acquire: true,
      download: false,
      upload: true,
      acquisitionsPerDay: '5',
      acquisitionBytesPerDay: '20'
    });
  });

  it('starts the create dialog without a quota and without permissions', () => {
    const fields = emptyUserFields();

    expect(fields.acquisitionsPerDay).toBe('');
    expect(fields.isAdmin).toBe(false);
    expect(newUserBody(fields).quota).toEqual({
      acquisitionsPerDay: null,
      acquisitionBytesPerDay: null
    });
  });

  it('reads an empty quota field as unlimited', () => {
    const fields = { ...emptyUserFields(), acquisitionsPerDay: '  ' };

    expect(quotaOfFields(fields).acquisitionsPerDay).toBeNull();
  });

  it('reads a quota field as a whole number', () => {
    const fields = {
      ...emptyUserFields(),
      acquisitionsPerDay: '12.7',
      acquisitionBytesPerDay: 'x'
    };

    expect(quotaOfFields(fields)).toEqual({
      acquisitionsPerDay: 12,
      acquisitionBytesPerDay: null
    });
  });

  it('reads the byte quota in GiB and stores whole bytes', () => {
    const whole = { ...emptyUserFields(), acquisitionBytesPerDay: '20' };
    const fraction = { ...emptyUserFields(), acquisitionBytesPerDay: '1.5' };
    const small = { ...emptyUserFields(), acquisitionBytesPerDay: '0.25' };

    expect(quotaOfFields(whole).acquisitionBytesPerDay).toBe(20 * 1024 ** 3);
    expect(quotaOfFields(fraction).acquisitionBytesPerDay).toBe(1.5 * 1024 ** 3);
    expect(quotaOfFields(small).acquisitionBytesPerDay).toBe(0.25 * 1024 ** 3);
    expect(
      quotaOfFields({ ...emptyUserFields(), acquisitionBytesPerDay: '' }).acquisitionBytesPerDay
    ).toBeNull();
    expect(
      quotaOfFields({ ...emptyUserFields(), acquisitionBytesPerDay: '-1' }).acquisitionBytesPerDay
    ).toBeNull();
  });

  it('leaves the password out of an edit that did not set one', () => {
    const body = userPatchBody({ ...userFields(user), displayName: ' Ada Lovelace ' });

    expect(body.password).toBeUndefined();
    expect(body.displayName).toBe('Ada Lovelace');
    expect(body.permissions).toEqual({ acquire: true, download: false, upload: true });
    expect(body.quota).toEqual({
      acquisitionsPerDay: 5,
      acquisitionBytesPerDay: 20 * 1024 ** 3
    });
  });

  it('sends the password of an edit that set one', () => {
    expect(userPatchBody({ ...userFields(user), password: 'new-secret' }).password).toBe(
      'new-secret'
    );
  });

  it('creates an account with the name that was typed', () => {
    const body = newUserBody({
      ...emptyUserFields(),
      username: ' grace ',
      displayName: '',
      password: 'secret',
      isAdmin: true
    });

    expect(body.username).toBe('grace');
    expect(body.displayName).toBeNull();
    expect(body.isAdmin).toBe(true);
    expect(body.password).toBe('secret');
  });
});

describe('account columns', () => {
  it('lists the permissions an account holds', () => {
    expect(permissionsText(user)).toBe('Acquire, Upload');
    expect(
      permissionsText({ ...user, permissions: { acquire: false, download: false, upload: false } })
    ).toBe('Stream only');
  });

  it('words a quota and calls an account without one unlimited', () => {
    expect(quotaText(user)).toBe('5 per day, 20 GiB per day');
    expect(quotaText({ ...user, quota: {} })).toBe('Unlimited');
  });

  it('joins the role, the permissions and the quota into the row summary', () => {
    expect(userSummary(user)).toBe(
      'ada - Administrator - Acquire, Upload - 5 per day, 20 GiB per day'
    );
    expect(userSummary({ ...user, isAdmin: false, quota: {} })).toBe(
      'ada - Member - Acquire, Upload - Unlimited'
    );
  });

  it('reads an account as disabled only when the server recorded it', () => {
    expect(isDisabled(user)).toBe(false);
    expect(isDisabled({ ...user, disabledAt: 3 })).toBe(true);
  });
});

describe('newPasswordProblem', () => {
  it('asks for a password and mirrors the server length', () => {
    expect(newPasswordProblem('')).toBe('Choose a password.');
    expect(newPasswordProblem('short12')).toBe('A password is at least 8 characters long.');
    expect(newPasswordProblem('long-enough')).toBeNull();
    expect(newPasswordProblem('x'.repeat(64))).toBeNull();
  });
});

describe('usernameProblem', () => {
  it('accepts the names the rules allow', () => {
    for (const name of ['echo', 'ada-2', 'a.b_c', 'User_1000', 'x'.repeat(32)]) {
      expect(usernameProblem(name)).toBeNull();
    }
  });

  it('refuses names with spaces, punctuation or an empty edge', () => {
    expect(usernameProblem('test user 100000%')).toBe(
      'A username holds letters, digits, dots, dashes and underscores only.'
    );
    expect(usernameProblem('DROP TABLE Users;')).toBe(
      'A username holds letters, digits, dots, dashes and underscores only.'
    );
    expect(usernameProblem('-echo')).toBe('A username starts and ends with a letter or a digit.');
    expect(usernameProblem('name ')).toBe(
      'A username holds letters, digits, dots, dashes and underscores only.'
    );
    expect(usernameProblem(' name')).toBe(
      'A username holds letters, digits, dots, dashes and underscores only.'
    );
    expect(usernameProblem('ab')).toBe('A username is at least 3 characters long.');
    expect(usernameProblem('x'.repeat(33))).toBe('A username is at most 32 characters long.');
  });
});
