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

import { formatBytes } from './bytes';

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
  /** How many acquisitions the account may start in 24 hours; empty is unlimited. */
  acquisitionsPerDay: string;
  /** How many bytes of acquired files the account may add in 24 hours; empty is unlimited. */
  acquisitionBytesPerDay: string;
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
        : String(user.quota.acquisitionBytesPerDay)
  };
}

/**
 * Reads one quota field.
 *
 * @param text The text of the field.
 * @returns The whole number, or `null` when the field is empty or not a
 *   number, which leaves that part of the quota unlimited.
 */
function quotaValue(text: string): number | null {
  const value = parseNumber(text);
  return value === undefined ? null : Math.trunc(value);
}

/**
 * Returns the quota of the dialog's fields.
 *
 * @param fields The dialog's fields.
 * @returns The quota; both values are `null` when the account is unlimited.
 */
export function quotaOfFields(fields: UserFields): QuotaView {
  return {
    acquisitionsPerDay: quotaValue(fields.acquisitionsPerDay),
    acquisitionBytesPerDay: quotaValue(fields.acquisitionBytesPerDay)
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
 * @returns The daily quota, or `Unlimited` when neither part is set.
 */
export function quotaText(user: AdminUser): string {
  const parts: string[] = [];
  const perDay = user.quota.acquisitionsPerDay;
  const bytesPerDay = user.quota.acquisitionBytesPerDay;
  if (perDay !== undefined && perDay !== null) {
    parts.push(`${perDay} per day`);
  }
  if (bytesPerDay !== undefined && bytesPerDay !== null) {
    parts.push(`${formatBytes(bytesPerDay)} per day`);
  }
  return parts.length === 0 ? 'Unlimited' : parts.join(', ');
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
