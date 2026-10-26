/**
 * The music folder fields the admin view edits.
 *
 * A folder is either owned by one account or generic, and the view says which
 * of the two a dialog holds; the scan of a folder reports itself line by line
 * through the event stream and its last failure stays in the row until the next
 * scan. The server words that failure as a complete sentence, so the row shows
 * it as it arrives (E-A-8). Removing one folder takes the likes and playlist
 * entries of its songs with it, which the view previews before it asks. This
 * module words both for the table.
 */
import type { components } from '#lib/api/schema';
import type { ScanProgressPayload } from '#lib/stores/events.svelte';

import type { ServerSetting } from './settings';

/** A scanned library folder. */
export type FolderView = components['schemas']['FolderView'];

/** A folder to add. */
export type NewFolder = components['schemas']['NewFolder'];

/** The changes to a folder. */
export type FolderPatch = components['schemas']['FolderPatch'];

/** How a folder is associated with an account. */
export interface FolderAssociation {
  /** Whether the folder is in nobody's library. */
  generic: boolean;
  /** The account the folder joins (`us_...`), when it is not generic. */
  owner: string;
}

/**
 * Words when a folder was last scanned, the way the row reads it.
 *
 * The row says "2 hours ago" or "Yesterday" rather than a timestamp (p23); an
 * older scan keeps a date, because a count of days stops being useful.
 *
 * @param at The scan's time in milliseconds, or `null` when it never ran.
 * @param now The moment the wording is measured from, in milliseconds.
 * @returns "Never scanned" or "Last scan <when>".
 */
export function lastScanText(at: number | null | undefined, now = Date.now()): string {
  if (at === undefined || at === null) {
    return 'Never scanned';
  }
  const elapsed = now - at;
  if (elapsed < 60_000) {
    return 'Last scan just now';
  }
  if (elapsed < 3_600_000) {
    const minutes = Math.floor(elapsed / 60_000);
    return `Last scan ${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  if (elapsed < 86_400_000) {
    const hours = Math.floor(elapsed / 3_600_000);
    return `Last scan ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  const days = Math.floor(elapsed / 86_400_000);
  if (days === 1) {
    return 'Last scan Yesterday';
  }
  if (days < 7) {
    return `Last scan ${days} days ago`;
  }
  return `Last scan ${new Date(at).toLocaleDateString()}`;
}

/**
 * Returns the owner column of one folder.
 *
 * @param folder The folder to describe.
 * @param names The display name of every account, by client id.
 * @returns The owner's display name, `Generic` for a folder nobody owns, or the
 *   owner's id when the account is not in the list.
 */
export function ownerLabel(folder: FolderView, names: ReadonlyMap<string, string>): string {
  if (folder.generic || folder.owner === undefined || folder.owner === null) {
    return 'Generic';
  }
  return names.get(folder.owner) ?? folder.owner;
}

/**
 * Returns the line a folder's live scan shows.
 *
 * The terminal frame of a scan that did not finish cleanly carries the server's
 * own sentence for it: "Scan failed: ..." when the scan stopped, and the same
 * sentence the folder row stores when it finished with a warning, such as a
 * refused prune or entries it could not read. The sentence is complete, so the
 * line renders it verbatim and adds no wording of its own (E-A-8).
 *
 * @param progress The progress the server published for the folder.
 * @returns The line, which reports the problem instead of the counters when the
 *   frame carries one.
 */
export function scanProgressText(progress: ScanProgressPayload): string {
  if (progress.error !== undefined && progress.error !== '') {
    return progress.error;
  }
  if (progress.phase === 'done') {
    return `Scan finished: ${progress.filesDone} of ${progress.filesSeen} files`;
  }
  if (progress.phase === 'pruning') {
    return `Removing missing files: ${progress.filesSeen} seen`;
  }
  return `Scanning: ${progress.filesDone} of ${progress.filesSeen} files`;
}

/**
 * Returns the failure line of a folder's last scan, or `null` when it did not
 * fail.
 *
 * `lastScanError` is the server's complete sentence - "Scan failed: ..." when
 * the scan stopped, "Nothing was removed: ..." when it refused to remove
 * anything, "3 entries could not be read and were skipped ..." when it finished
 * with a warning - so the row shows it verbatim; a prefix of the client's own
 * would say it twice (E-A-8).
 *
 * @param folder The folder to describe.
 * @returns The line the row shows in the error style, or `null` when the last
 *   scan left no error.
 */
export function failedScanText(folder: FolderView): string | null {
  const error = folder.lastScanError;
  return error === undefined || error === null || error === '' ? null : error;
}

/** What removing one folder would take with it, as the server previews it. */
export type FolderRemovalImpact = components['schemas']['RemovalImpactView'];

/**
 * Returns whether removing a folder asks for confirmation first.
 *
 * A server that does not report the setting yet still asks, so an
 * administrator never loses likes and playlist entries unannounced.
 *
 * @param settings Every registered server setting.
 * @returns `false` only when the administrator switched the question off.
 */
export function confirmsFolderRemoval(settings: readonly ServerSetting[]): boolean {
  const setting = settings.find((candidate) => candidate.key === 'library.confirm_folder_removal');
  if (setting === undefined) {
    return true;
  }
  const value: unknown = setting.value;
  return value !== false;
}

/**
 * Words the counts a folder removal would take with it.
 *
 * @param impact The counts the preview reported.
 * @returns The sentence the confirmation shows above its commands.
 */
export function removalImpactText(impact: FolderRemovalImpact): string {
  if (impact.likes === 0 && impact.playlistEntries === 0) {
    return 'Nothing in this folder is liked or in a playlist.';
  }
  const likes = countText(impact.likes, 'like', 'likes');
  const entries = countText(impact.playlistEntries, 'playlist entry', 'playlist entries', false);
  return `${likes} and ${entries} on songs in this folder will be lost.`;
}

/**
 * Words one count of the removal impact.
 *
 * @param count How many there are.
 * @param one The singular noun.
 * @param many The plural noun, which English does not always build with "s".
 * @param capitalised Whether the count starts the sentence, which only a zero
 *   count spells differently ("No likes", then "no playlist entries").
 * @returns "No likes", "1 like" or "3 likes".
 */
function countText(count: number, one: string, many: string, capitalised = true): string {
  if (count === 0) {
    return `${capitalised ? 'No' : 'no'} ${many}`;
  }
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

/**
 * Returns the association fields a folder body carries.
 *
 * Exactly one of `owner` and `generic` is named, so sending the other as `null`
 * clears it: a folder is either owned or generic, never both.
 *
 * @param association The association the dialog holds.
 * @returns The fields to send.
 */
function associationFields(association: FolderAssociation): {
  owner: string | null;
  generic: boolean | null;
} {
  if (association.generic) {
    return { owner: null, generic: true };
  }
  return { owner: association.owner, generic: null };
}

/**
 * Returns the body that adds one folder.
 *
 * @param path The folder's absolute path on the server.
 * @param name The display name; empty means the directory name.
 * @param watch Whether to watch the folder for changes.
 * @param association The association the dialog holds.
 * @returns The body of the create request.
 */
export function newFolderBody(
  path: string,
  name: string,
  watch: boolean,
  association: FolderAssociation
): NewFolder {
  const displayName = name.trim();
  return {
    path: path.trim(),
    name: displayName === '' ? null : displayName,
    watch: watch,
    ...associationFields(association)
  };
}

/**
 * Returns the changes one folder edit sends.
 *
 * @param name The new display name.
 * @param watch Whether to watch the folder for changes.
 * @param association The association the dialog holds.
 * @returns The body of the patch request.
 */
export function folderPatchBody(
  name: string,
  watch: boolean,
  association: FolderAssociation
): FolderPatch {
  return {
    name: name.trim(),
    watch: watch,
    ...associationFields(association)
  };
}
