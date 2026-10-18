/**
 * The native API calls several admin views make.
 *
 * A view that lists rows pages through them itself; the calls here are the ones
 * that fetch a whole collection because another view offers it as a choice.
 */
import { nativeClient } from '#lib/api/native';

import type { AdminUser } from './users';

/** How many rows one page of a listing asks for. */
const PAGE_SIZE = 200;

/**
 * Loads every account.
 *
 * The folder view offers an account to associate a folder with, and the
 * provider view one to name a display name after, so both need the whole list
 * rather than its first page.
 *
 * @returns The accounts, by username; the pages that arrived when the server
 *   refused a later one.
 */
export async function loadAllUsers(): Promise<AdminUser[]> {
  const users: AdminUser[] = [];
  let cursor: string | null = null;
  do {
    const query: { limit: number; cursor?: string } =
      cursor === null ? { limit: PAGE_SIZE } : { limit: PAGE_SIZE, cursor };
    const answer = await nativeClient.GET('/api/v1/admin/users', { params: { query } });
    if (answer.data === undefined) {
      return users;
    }
    users.push(...answer.data.users);
    cursor = answer.data.nextCursor ?? null;
  } while (cursor !== null);
  return users;
}
