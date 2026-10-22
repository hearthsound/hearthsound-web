/**
 * The account fields the admin views edit.
 *
 * A dialog holds every value as text so an administrator can leave a quota or a
 * password empty, which means unlimited or unchanged; this module maps those
 * fields to the bodies the native API takes and back to the fields an existing
 * account is edited with.
 */
import type { components } from '#lib/api/schema';
import { parseNumber } from '#lib/jsonforms/value';

import { formatGiB, parseGiB } from '#lib/format';

/** An account as an administrator sees it. */
export type AdminUser = components['schemas']['AdminUser'];

/** What an account may do besides streaming. */
export type PermissionsView = components['schemas']['PermissionsView'];

/** A daily acquisition quota; a field that is `null` is unlimited. */
export type QuotaView = components['schemas']['QuotaView'];

/** The body that creates one account. */
export type NewUserRequest = components['schemas']['NewUserRequest'];

/** The changes one account edit sends. */
export type UserPatch = components['schemas']['UserPatch'];

/** What the account dialog holds. */
export interface UserFields {
  /** The sign-in name. */
  username: string;
  /** The name clients show. */
  displayName: string;
  /** The password; empty means the stored one is kept. */
  password: string;
  /** Whether the account administers the server. */
  isAdmin: boolean;
  /** Whether the account may trigger acquisitions. */
  acquire: boolean;
  /** Whether the account may download files. */
  download: boolean;
  /** Whether the account may upload files. */
  upload: boolean;
  /**
   * How many acquisitions the account may start in 24 hours; empty is
   * unlimited. A number field reports its value as a number once it is edited.
   */
  acquisitionsPerDay: string | number;
  /**
   * How many GiB of acquired files the account may add in 24 hours (stored as
   * bytes); empty is unlimited. A number field reports its value as a number
   * once it is edited.
   */
  acquisitionBytesPerDay: string | number;
}

/** The shortest username the server accepts. */
export const USERNAME_MIN_LENGTH = 3;

/** The longest username the server accepts. */
export const USERNAME_MAX_LENGTH = 32;

/**
 * Checks a username against the rules the server enforces.
 *
 * The client repeats the rule so the dialog can say what is wrong before the
 * request; a name is 3 to 32 characters of letters, digits, dots, dashes and
 * underscores, starting and ending with a letter or a digit. The value is
 * checked as typed, so a trailing space is a space, not a trimmed character.
 *
 * @param username The name as typed.
 * @returns The sentence that explains what is wrong, or `null` when it is
 *   allowed.
 */
export function usernameProblem(username: string): string | null {
  const name = username;
  if (name.length < USERNAME_MIN_LENGTH) {
    return `A username is at least ${USERNAME_MIN_LENGTH} characters long.`;
  }
  if (name.length > USERNAME_MAX_LENGTH) {
    return `A username is at most ${USERNAME_MAX_LENGTH} characters long.`;
  }
  if (!/^[A-Za-z0-9._-]+$/.test(name)) {
    return 'A username holds letters, digits, dots, dashes and underscores only.';
  }
  if (!/^[A-Za-z0-9]/.test(name) || !/[A-Za-z0-9]$/.test(name)) {
    return 'A username starts and ends with a letter or a digit.';
  }
  return null;
}

/**
 * Checks the display name of an account.
 *
 * @param displayName The name as typed.
 * @returns The sentence that explains what is wrong, or `null` when it is
 *   allowed.
 */
export function displayNameProblem(displayName: string): string | null {
  return displayName.trim() === '' ? 'Choose a display name.' : null;
}

/**
 * Checks the password a new account is created with.
 *
 * @param password The password as typed.
 * @returns The sentence that explains what is wrong, or `null` when it is
 *   allowed.
 */
export function newPasswordProblem(password: string): string | null {
  return password === '' ? 'Choose a password.' : null;
}

/**
 * Returns the fields of the create dialog.
 *
 * @returns The fields, with every permission off, no quota and no password.
 */
export function emptyUserFields(): UserFields {
  return {
    username: '',
    displayName: '',
    password: '',
    isAdmin: false,
    acquire: false,
    download: false,
    upload: false,
    acquisitionsPerDay: '',
    acquisitionBytesPerDay: ''
  };
}

/**
 * Returns the fields the edit dialog opens an account with.
 *
 * @param user The account to edit.
 * @returns The fields, with the password left empty.
 */
export function userFields(user: AdminUser): UserFields {
  return {
    username: user.username,
    displayName: user.displayName,
    password: '',
    isAdmin: user.isAdmin,
    acquire: user.permissions.acquire,
    download: user.permissions.download,
    upload: user.permissions.upload,
    acquisitionsPerDay:
      user.quota.acquisitionsPerDay === undefined || user.quota.acquisitionsPerDay === null
        ? ''
        : String(user.quota.acquisitionsPerDay),
    acquisitionBytesPerDay:
      user.quota.acquisitionBytesPerDay === undefined || user.quota.acquisitionBytesPerDay === null
        ? ''
        : formatGiB(user.quota.acquisitionBytesPerDay)
  };
}

/**
 * Reads one quota field.
 *
 * @param text The value of the field, which a number input reports as a number
 *   once it is edited and as text before that.
 * @returns The whole number, or `null` when the field is empty or not a
 *   number, which leaves that part of the quota unlimited.
 */
function quotaValue(text: unknown): number | null {
  if (text === null || text === undefined || text === '') {
    return null;
  }
  const value =
    typeof text === 'number' ? text : typeof text === 'string' ? parseNumber(text) : undefined;
  return value === undefined || !Number.isFinite(value) ? null : Math.trunc(value);
}

/**
 * Returns the quota of the dialog's fields.
 *
 * The acquisition count is a whole number; the byte quota is entered in GiB and
 * stored in whole bytes. A field that is empty or not a number leaves that part
 * of the quota unlimited.
 *
 * @param fields The dialog's fields.
 * @returns The quota; both values are `null` when the account is unlimited.
 */
export function quotaOfFields(fields: UserFields): QuotaView {
  return {
    acquisitionsPerDay: quotaValue(fields.acquisitionsPerDay),
    acquisitionBytesPerDay: parseGiB(fields.acquisitionBytesPerDay)
  };
}

/**
 * Returns the permissions of the dialog's fields.
 *
 * @param fields The dialog's fields.
 * @returns The permissions.
 */
export function permissionsOfFields(fields: UserFields): PermissionsView {
  return { acquire: fields.acquire, download: fields.download, upload: fields.upload };
}

/**
 * Returns the permission column of one account.
 *
 * @param user The account to describe.
 * @returns The permissions it holds, or `Stream only` when it holds none.
 */
export function permissionsText(user: AdminUser): string {
  const granted: string[] = [];
  if (user.permissions.acquire) {
    granted.push('Acquire');
  }
  if (user.permissions.download) {
    granted.push('Download');
  }
  if (user.permissions.upload) {
    granted.push('Upload');
  }
  return granted.length === 0 ? 'Stream only' : granted.join(', ');
}

/**
 * Returns the quota column of one account.
 *
 * @param user The account to describe.
 * @returns The daily quota with the byte limit in GiB, or `Unlimited` when
 *   neither part is set.
 */
export function quotaText(user: AdminUser): string {
  const parts: string[] = [];
  const perDay = user.quota.acquisitionsPerDay;
  const bytesPerDay = user.quota.acquisitionBytesPerDay;
  if (perDay !== undefined && perDay !== null) {
    parts.push(`${perDay} per day`);
  }
  if (bytesPerDay !== undefined && bytesPerDay !== null) {
    parts.push(`${formatGiB(bytesPerDay)} GiB per day`);
  }
  return parts.length === 0 ? 'Unlimited' : parts.join(', ');
}

/**
 * Returns whether an account cannot sign in.
 *
 * @param user The account to read.
 * @returns `true` when the server recorded that the account was disabled.
 */
export function isDisabled(user: AdminUser): boolean {
  return user.disabledAt !== undefined && user.disabledAt !== null;
}

/**
 * Returns the muted summary line of one account row.
 *
 * @param user The account to describe.
 * @returns The username, the role, the permissions and the quota, joined by
 *   " - ".
 */
export function userSummary(user: AdminUser): string {
  const role = user.isAdmin ? 'Administrator' : 'Member';
  return `${user.username} - ${role} - ${permissionsText(user)} - ${quotaText(user)}`;
}

/**
 * Returns the body that creates the account the dialog describes.
 *
 * @param fields The dialog's fields.
 * @returns The body of the create request.
 */
export function newUserBody(fields: UserFields): NewUserRequest {
  const displayName = fields.displayName.trim();
  return {
    username: fields.username.trim(),
    displayName: displayName === '' ? null : displayName,
    password: fields.password,
    isAdmin: fields.isAdmin,
    permissions: permissionsOfFields(fields),
    quota: quotaOfFields(fields)
  };
}

/**
 * Returns the changes one account edit sends.
 *
 * The password is left out when the administrator did not type a new one, so
 * the stored password keeps working; the display name, the permissions and the
 * quota are sent in full because the dialog shows all of them.
 *
 * @param fields The dialog's fields.
 * @returns The body of the patch request.
 */
export function userPatchBody(fields: UserFields): UserPatch {
  const body: UserPatch = {
    displayName: fields.displayName.trim(),
    isAdmin: fields.isAdmin,
    permissions: permissionsOfFields(fields),
    quota: quotaOfFields(fields)
  };
  if (fields.password !== '') {
    body.password = fields.password;
  }
  return body;
}
