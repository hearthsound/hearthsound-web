/**
 * The save location of the signed-in account (UR4, decision 21).
 *
 * A listener may keep the music they save in one of the scanned folders they
 * own instead of the server's managed library; the setting names that folder,
 * and the folder picker on the account page is built from the folders the
 * server reports as the caller's own. The page never calls the native client
 * itself, so a test can replace one call, and every call answers the account
 * area's {@link LinkResult}, including a request the network refused.
 */
import type { components } from '#lib/api/schema';
import { nativeClient } from '#lib/api/native';
import { problemMessage } from '#lib/admin/problem';

import type { LinkResult } from './services';

/** One scanned folder the caller owns. */
export type MyFolderView = components['schemas']['MyFolderView'];

/** The setting key the save location is stored under. */
export const SAVE_FOLDER_SETTING = 'library.save_folder';

/**
 * Reads the scanned folders the caller owns.
 *
 * @returns The folders, ordered by name, or the refusal.
 */
export async function listSaveFolders(): Promise<LinkResult<MyFolderView[]>> {
  try {
    const answer = await nativeClient.GET('/api/v1/me/folders');
    if (answer.data === undefined) {
      return { ok: false, message: problemMessage(answer.error, 'Could not load the folders.') };
    }
    return { ok: true, value: answer.data.folders };
  } catch {
    return { ok: false, message: 'Could not read the folders.' };
  }
}

/**
 * Reads the folder the caller saves into.
 *
 * The settings answer carries every overridable setting with the value in
 * effect for the caller; the save location is a plain string, and a value that
 * is not one (or no entry at all) means the managed library.
 *
 * @returns The folder's client id, `null` for the managed library, or the
 *   refusal.
 */
export async function readSaveFolder(): Promise<LinkResult<string | null>> {
  try {
    const answer = await nativeClient.GET('/api/v1/me/settings');
    if (answer.data === undefined) {
      return { ok: false, message: problemMessage(answer.error, 'Could not load the settings.') };
    }
    const entry = answer.data.settings.find((setting) => setting.key === SAVE_FOLDER_SETTING);
    const value: unknown = entry?.value;
    return { ok: true, value: typeof value === 'string' && value !== '' ? value : null };
  } catch {
    return { ok: false, message: 'Could not read the settings.' };
  }
}

/**
 * Stores the folder the caller saves into.
 *
 * The server refuses a folder the caller does not own, and removes the override
 * when the value is `null`, which is what the managed library is.
 *
 * @param value The folder's client id, or `null` for the managed library.
 * @returns Nothing, or the refusal.
 */
export async function writeSaveFolder(value: string | null): Promise<LinkResult<void>> {
  try {
    // The document types a setting's value as a free-form object, because a
    // setting may be one; the save location is the folder's id or `null`, so
    // the body is named as the one member it carries.
    const body = { settings: { [SAVE_FOLDER_SETTING]: value } } as unknown as {
      settings: Record<string, never>;
    };
    const answer = await nativeClient.PATCH('/api/v1/me/settings', { body });
    if (answer.data === undefined) {
      return { ok: false, message: problemMessage(answer.error, 'Could not save the location.') };
    }
    return { ok: true, value: undefined };
  } catch {
    return { ok: false, message: 'Could not save this location.' };
  }
}
