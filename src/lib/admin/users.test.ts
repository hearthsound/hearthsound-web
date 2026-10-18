/**
 * Tests for the account fields the admin view maps to the native API bodies.
 */
import { describe, expect, it } from 'vitest';

import {
  emptyUserFields,
  newUserBody,
  permissionsText,
  quotaOfFields,
  quotaText,
  userFields,
  userPatchBody
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
  quota: { acquisitionsPerDay: 5, acquisitionBytesPerDay: 1000 }
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
      acquisitionBytesPerDay: '1000'
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

  it('leaves the password out of an edit that did not set one', () => {
    const body = userPatchBody({ ...userFields(user), displayName: ' Ada Lovelace ' });

    expect(body.password).toBeUndefined();
    expect(body.displayName).toBe('Ada Lovelace');
    expect(body.permissions).toEqual({ acquire: true, download: false, upload: true });
    expect(body.quota).toEqual({ acquisitionsPerDay: 5, acquisitionBytesPerDay: 1000 });
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
    expect(quotaText(user)).toBe('5 per day, 1000 B per day');
    expect(quotaText({ ...user, quota: {} })).toBe('Unlimited');
  });
});
