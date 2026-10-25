/**
 * The music folder endpoints the admin view and the setup wizard call.
 *
 * Every call names the sentence its view shows when the server did not answer;
 * a scan answers with the queue entry the server created, which the view
 * ignores because the scan reports itself through the event stream. The removal
 * preview answers the counts a removal would take with it, which the admin view
 * shows before it asks for the confirmation. Every call answers through
 * {@link guard}, so a request that never reached the server is a refused answer
 * rather than a thrown rejection.
 */
import type { components } from '#lib/api/schema';
import { nativeClient } from '#lib/api/native';

import { guard, refused, okay, settled } from './result';
import type { AdminResult } from './result';
import type { FolderPatch, FolderRemovalImpact, FolderView, NewFolder } from '../folders';

/** The queue entry a scan request answers with. */
type ScanQueued = components['schemas']['ScanQueued'];

/**
 * Reads every music folder.
 *
 * @returns The folders, in the order the server lists them.
 */
export async function listFolders(): Promise<AdminResult<FolderView[]>> {
  return guard(async () => {
    const answer = await nativeClient.GET('/api/v1/admin/folders');
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not load the folders.', answer.response.status);
    }
    return okay(answer.data.folders);
  });
}

/**
 * Adds one music folder.
 *
 * @param body The folder to add.
 * @returns The folder the server answered with.
 */
export async function createFolder(body: NewFolder): Promise<AdminResult<FolderView>> {
  return guard(async () => {
    const answer = await nativeClient.POST('/api/v1/admin/folders', { body });
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not save the folder.', answer.response.status);
    }
    return okay(answer.data);
  });
}

/**
 * Changes one music folder.
 *
 * @param id The folder's id.
 * @param body The changes to send.
 * @returns The folder as it is now.
 */
export async function updateFolder(
  id: string,
  body: FolderPatch
): Promise<AdminResult<FolderView>> {
  return guard(async () => {
    const answer = await nativeClient.PATCH('/api/v1/admin/folders/{id}', {
      params: { path: { id } },
      body
    });
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not save the folder.', answer.response.status);
    }
    return okay(answer.data);
  });
}

/**
 * Counts what removing one folder would take with it.
 *
 * @param id The folder's id.
 * @returns The tracks the removal deletes and, among them, the likes and
 *   playlist entries that go with them.
 */
export async function folderRemovalImpact(id: string): Promise<AdminResult<FolderRemovalImpact>> {
  return guard(async () => {
    const answer = await nativeClient.GET('/api/v1/admin/folders/{id}/removal-impact', {
      params: { path: { id } }
    });
    if (answer.data === undefined) {
      return refused(
        answer.error,
        'Could not check what removing this folder would delete.',
        answer.response.status
      );
    }
    return okay(answer.data);
  });
}

/**
 * Removes one music folder from the library.
 *
 * @param id The folder's id.
 * @returns Nothing, or the refusal.
 */
export async function deleteFolder(id: string): Promise<AdminResult<void>> {
  return guard(async () => {
    const answer = await nativeClient.DELETE('/api/v1/admin/folders/{id}', {
      params: { path: { id } }
    });
    return settled(answer.response.status, answer.error, 'Could not remove the folder.');
  });
}

/**
 * Queues a scan of one folder.
 *
 * @param id The folder's id.
 * @param full Whether to re-read every file instead of the changed ones.
 * @returns The queue entry, or the refusal.
 */
export async function scanFolder(id: string, full: boolean): Promise<AdminResult<ScanQueued>> {
  return guard(async () => {
    const answer = await nativeClient.POST('/api/v1/admin/folders/{id}/scan', {
      params: { path: { id } },
      body: { full }
    });
    if (answer.data === undefined) {
      return refused(answer.error, 'Could not start the scan.', answer.response.status);
    }
    return okay(answer.data);
  });
}
