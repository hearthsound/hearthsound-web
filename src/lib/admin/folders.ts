/**
 * The music folder fields the admin view edits.
 *
 * A folder is either owned by one account or generic, and the view says which
 * of the two a dialog holds; the scan of a folder reports itself line by line
 * through the event stream. This module words both for the table.
 */
import type { components } from '#lib/api/schema';
import type { ScanProgressPayload } from '#lib/stores/events.svelte';

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
 * @param progress The progress the server published for the folder.
 * @returns The line, which reports the failure instead of the counters when the
 *   scan stopped.
 */
export function scanProgressText(progress: ScanProgressPayload): string {
  if (progress.error !== undefined) {
    return `Scan failed: ${progress.error}`;
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
