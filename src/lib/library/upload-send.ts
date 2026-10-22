/**
 * The orchestration of one visit's uploads.
 *
 * The upload page adds the files the picker or the drop answered with to the
 * queue and sends each one; this module owns what an answer means for the
 * file's row: a 413 is "Too large", any other HTTP failure names the status, an
 * answer without an entry for the file is a failure, and a request that never
 * completed is a failure with the transport's reason. Keeping that mapping out
 * of the component lets the failure branches be tested without a browser.
 */
import { uploadFile } from './uploader';
import type { UploadOutcome } from './uploader';
import type { UploadItem, UploadQueue } from './upload.svelte';
import type { UploadEntry } from './uploads';

/** How one upload request is made. */
export type UploadTransport = (
  file: File,
  csrfToken: string | null,
  onProgress: (percent: number) => void
) => Promise<UploadOutcome>;

/**
 * Sends one queued file and records what the server made of it.
 *
 * @param id The item's identity in the queue.
 * @param file The file to send.
 * @param csrfToken The session's CSRF token, or `null` when there is none.
 * @param queue The queue the file's row belongs to.
 * @param send The request to make; the page uses the real one.
 * @returns The entry the answer carried, or `null` when the file was refused.
 */
export async function beginUpload(
  id: number,
  file: File,
  csrfToken: string | null,
  queue: UploadQueue,
  send: UploadTransport = uploadFile
): Promise<UploadEntry | null> {
  queue.start(id);
  try {
    const outcome = await send(file, csrfToken, (percent) => queue.progress(id, percent));
    if (outcome.status === 413) {
      queue.tooLarge(id);
      return null;
    }
    if (outcome.status >= 400) {
      queue.fail(id, `the server answered HTTP ${outcome.status}`);
      return null;
    }
    const entry = outcome.entries[0];
    if (entry === undefined) {
      queue.fail(id, 'the server answered nothing about the file');
      return null;
    }
    queue.finish(id, entry);
    return entry;
  } catch (error) {
    queue.fail(
      id,
      error instanceof Error && error.message !== ''
        ? error.message
        : 'the upload did not go through'
    );
    return null;
  }
}

/**
 * Adds files to the queue and sends them all.
 *
 * Every file is one request, so they are sent together. The page learns about
 * each added row and each finished file so it can show a size and read the
 * uploads listing again once a file is stored.
 *
 * @param files The files the picker or the drop answered with.
 * @param csrfToken The session's CSRF token, or `null` when there is none.
 * @param queue The queue the rows belong to.
 * @param queued Called with each added row and its file.
 * @param finished Called with the entry of each file the server accepted.
 * @param send The request to make; the page uses the real one.
 * @returns Nothing.
 */
export function sendFiles(
  files: Iterable<File>,
  csrfToken: string | null,
  queue: UploadQueue,
  queued: (item: UploadItem, file: File) => void,
  finished: (entry: UploadEntry) => void,
  send: UploadTransport = uploadFile
): void {
  for (const file of files) {
    const [item] = queue.add([{ name: file.name }]);
    if (item === undefined) {
      continue;
    }
    queued(item, file);
    void beginUpload(item.id, file, csrfToken, queue, send).then((entry) => {
      if (entry !== null) {
        finished(entry);
      }
    });
  }
}
