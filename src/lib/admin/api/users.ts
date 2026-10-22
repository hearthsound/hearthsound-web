/**
 * The account endpoints the admin views and the setup wizard call.
 *
 * A listing pages by an opaque cursor; the page that follows the cursor is
 * shaped as the shared paged-list page, so a view hands it straight to
 * `PagedList`. Every call names its own fallback sentence, which is the only
 * wording a view shows when the server did not answer.
 */
import { nativeClient } from '#lib/api/native';
import type { Page } from '#lib/paging.svelte';

import { refused, okay, settled } from './result';
import type { AdminResult } from './result';
import type { AdminUser, NewUserRequest, UserPatch } from '../users';

/** How many accounts one page of a listing holds when the caller names no size. */
const PAGE_SIZE = 60;

/** How many accounts the whole-list read asks for at once. */
const ALL_PAGE_SIZE = 200;

/**
 * Reads one page of accounts, by username.
 *
 * @param cursor The cursor of the page to read, or `null` for the first one.
 * @param limit How many accounts the page may hold.
 * @returns The page, ready for a paged list.
 */
export async function listUsers(
  cursor: string | null,
  limit = PAGE_SIZE
): Promise<AdminResult<Page<AdminUser, string>>> {
  const answer = await nativeClient.GET('/api/v1/admin/users', {
    params: { query: cursor === null ? { limit } : { limit, cursor } }
  });
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not load the accounts.');
  }
  return okay({ items: answer.data.users, next: answer.data.nextCursor ?? null });
}

/**
 * Loads every account.
 *
 * The folder view offers an account to associate a folder with, and the
 * provider view one to name a display name after, so both need the whole list
 * rather than its first page.
 *
 * @returns Every account, by username, or the refusal of a page.
 */
export async function loadAllUsers(): Promise<AdminResult<AdminUser[]>> {
  const users: AdminUser[] = [];
  let cursor: string | null = null;
  for (;;) {
    const query: { limit: number; cursor?: string } =
      cursor === null ? { limit: ALL_PAGE_SIZE } : { limit: ALL_PAGE_SIZE, cursor };
    const answer = await nativeClient.GET('/api/v1/admin/users', { params: { query } });
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not load the accounts.');
    }
    users.push(...answer.data.users);
    cursor = answer.data.nextCursor ?? null;
    if (cursor === null) {
      return okay(users);
    }
  }
}

/**
 * Creates one account.
 *
 * @param body The account to create.
 * @returns The account the server answered with.
 */
export async function createUser(body: NewUserRequest): Promise<AdminResult<AdminUser>> {
  const answer = await nativeClient.POST('/api/v1/admin/users', { body });
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not save the account.');
  }
  return okay(answer.data);
}

/**
 * Replaces the fields of one account.
 *
 * @param id The account's id (`us_...`).
 * @param body The changes to send.
 * @returns The account as it is now.
 */
export async function patchUser(id: string, body: UserPatch): Promise<AdminResult<AdminUser>> {
  const answer = await nativeClient.PATCH('/api/v1/admin/users/{id}', {
    params: { path: { id } },
    body
  });
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not save the account.');
  }
  return okay(answer.data);
}

/**
 * Switches one account off or on again.
 *
 * @param id The account's id (`us_...`).
 * @param disabled Whether the account can no longer sign in.
 * @returns The account as it is now.
 */
export async function setUserDisabled(
  id: string,
  disabled: boolean
): Promise<AdminResult<AdminUser>> {
  const answer = await nativeClient.PATCH('/api/v1/admin/users/{id}', {
    params: { path: { id } },
    body: { disabled }
  });
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not change the account.');
  }
  return okay(answer.data);
}

/**
 * Deletes one account.
 *
 * @param id The account's id (`us_...`).
 * @returns Nothing, or the refusal.
 */
export async function deleteUser(id: string): Promise<AdminResult<void>> {
  const answer = await nativeClient.DELETE('/api/v1/admin/users/{id}', {
    params: { path: { id } }
  });
  return settled(answer.response.status, answer.error, 'Could not delete the account.');
}
