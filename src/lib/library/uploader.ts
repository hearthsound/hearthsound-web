/**
 * One upload request.
 *
 * A file travels in its own `XMLHttpRequest`, because the browser reports how
 * much of the body it has sent on that request and nothing else: the progress
 * bar of every file is driven by its own upload progress events. The request
 * carries the session's CSRF token, the way every other unsafe call to the
 * server does.
 */
import { CSRF_HEADER } from '#lib/api/native';

import { UPLOADS_PATH } from './uploads';
import type { UploadEntry } from './uploads';

/** What one upload request answered. */
export interface UploadOutcome {
  /** The HTTP status the server answered with. */
  status: number;
  /** The entries the answer carried, in order; empty for a refused request. */
  entries: UploadEntry[];
}

/**
 * Reads the entries out of an upload answer.
 *
 * A refused request answers with no body at all, so a body that is not the
 * expected JSON is read as no entries rather than as an error: the status is
 * what says what happened.
 *
 * @param body The response text.
 * @returns The entries the answer carried.
 */
function entriesOf(body: string): UploadEntry[] {
  try {
    const parsed = JSON.parse(body) as { uploads?: UploadEntry[] };
    return parsed.uploads ?? [];
  } catch {
    return [];
  }
}

/**
 * Sends one file.
 *
 * @param file The file to upload.
 * @param csrfToken The session's CSRF token, or `null` when there is none.
 * @param onProgress Called with the share of the body that has been sent, 0 to
 *   100.
 * @returns The server's answer.
 * @throws Error when the request could not be completed at all.
 */
export function uploadFile(
  file: File,
  csrfToken: string | null,
  onProgress: (percent: number) => void
): Promise<UploadOutcome> {
  const { promise, resolve, reject } = Promise.withResolvers<UploadOutcome>();
  const request = new XMLHttpRequest();
  request.open('POST', UPLOADS_PATH);
  if (csrfToken !== null) {
    request.setRequestHeader(CSRF_HEADER, csrfToken);
  }
  request.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable && event.total > 0) {
      onProgress((event.loaded / event.total) * 100);
    }
  });
  request.addEventListener('load', () =>
    resolve({ status: request.status, entries: entriesOf(request.responseText) })
  );
  request.addEventListener('error', () => reject(new Error('the server could not be reached')));
  request.addEventListener('abort', () => reject(new Error('the upload was stopped')));

  const body = new FormData();
  body.append('file', file, file.name);
  request.send(body);
  return promise;
}
