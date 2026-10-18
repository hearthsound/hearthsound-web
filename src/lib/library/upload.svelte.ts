/**
 * What the client is uploading and how far each file has come.
 *
 * One file is one request, so every file has its own state: the browser reports
 * how much of the body it has sent, the server reports an upload id in the
 * answer and publishes `upload.updated` while it stores the file, and the
 * entry the answer carries says what the file became. The states and the
 * transitions live here so the page renders one label per file and nothing has
 * to know the order the events arrive in.
 */

/** Where one upload is. */
export type UploadState = 'queued' | 'uploading' | 'processing' | 'done' | 'failed';

/** One file the user is uploading. */
export interface UploadItem {
  /** The item's identity, unique within the queue. */
  id: number;
  /** The file's name, without any directory part. */
  fileName: string;
  /** Where the upload is. */
  state: UploadState;
  /** How much of the body the browser has sent, 0 to 100. */
  percent: number;
  /** The server's upload id, once an answer or an event named one. */
  uploadId: string | null;
  /** What the file failed with, when it failed. */
  failure: string | null;
}

/** The part of a file the queue records. */
export interface UploadCandidate {
  /** The file's name, as the picker or the drop reported it. */
  name: string;
}

/**
 * Returns the text one upload shows.
 *
 * @param item The upload to describe.
 * @returns The label, which for an upload that failed is the failure itself.
 */
export function uploadLabel(item: UploadItem): string {
  if (item.state === 'queued') {
    return 'Waiting';
  }
  if (item.state === 'uploading') {
    return `Uploading ${Math.floor(item.percent)}%`;
  }
  if (item.state === 'processing') {
    return 'Processing';
  }
  if (item.state === 'done') {
    return 'Done';
  }
  return item.failure ?? 'Failed';
}

/** The files one visit to the upload page is sending. */
export class UploadQueue {
  /** The files, in the order they were added. */
  items = $state<UploadItem[]>([]);

  #nextId = 1;

  /**
   * Adds files to the queue, all of them waiting.
   *
   * @param files The files to add.
   * @returns The items that were added, in order, so the caller can send them
   *   one by one.
   */
  add(files: readonly UploadCandidate[]): UploadItem[] {
    const added = files.map((file) => ({
      id: this.#nextId++,
      fileName: file.name,
      state: 'queued' as const,
      percent: 0,
      uploadId: null,
      failure: null
    }));
    this.items = [...this.items, ...added];
    return added;
  }

  /**
   * Records that a file's request has started.
   *
   * @param id The item's identity.
   * @returns Nothing.
   */
  start(id: number): void {
    this.#update(id, (item) => ({ ...item, state: 'uploading', percent: 0 }));
  }

  /**
   * Records how much of a file's body the browser has sent.
   *
   * @param id The item's identity.
   * @param percent The share of the body that was sent, as the browser reports
   *   it; it is clamped into 0 to 100.
   * @returns Nothing.
   */
  progress(id: number, percent: number): void {
    const clamped = Math.min(Math.max(percent, 0), 100);
    this.#update(id, (item) => ({ ...item, state: 'uploading', percent: clamped }));
  }

  /**
   * Records that the server is storing the file whose upload id it named.
   *
   * The id is matched against what an answer already said; while no answer has
   * arrived yet, the event belongs to the file whose request is still running,
   * which is the order the events arrive in.
   *
   * @param uploadId The server's upload id.
   * @returns Nothing.
   */
  processing(uploadId: string): void {
    const named = this.items.find((item) => item.uploadId === uploadId);
    const item =
      named ?? this.items.find((entry) => entry.state === 'uploading' && entry.uploadId === null);
    if (item === undefined || item.state === 'done' || item.state === 'failed') {
      return;
    }
    this.#update(item.id, (entry) => ({ ...entry, state: 'processing', uploadId }));
  }

  /**
   * Records what the server made of a file.
   *
   * @param id The item's identity.
   * @param entry The entry the upload answer carried for it.
   * @returns Nothing.
   */
  finish(
    id: number,
    entry: { state: string; uploadId: string; detail?: string | null; error?: string | null }
  ): void {
    if (entry.state === 'completed') {
      this.#update(id, (item) => ({
        ...item,
        state: 'done',
        percent: 100,
        uploadId: entry.uploadId
      }));
      return;
    }
    const detail = entry.detail ?? entry.error ?? null;
    this.fail(id, detail === null ? 'the server refused it' : detail, entry.uploadId);
  }

  /**
   * Records that a file was larger than the server accepts.
   *
   * @param id The item's identity.
   * @returns Nothing.
   */
  tooLarge(id: number): void {
    this.#update(id, (item) => ({ ...item, state: 'failed', failure: 'Too large' }));
  }

  /**
   * Records that a file could not be uploaded.
   *
   * @param id The item's identity.
   * @param reason What went wrong.
   * @param uploadId The server's upload id, when one was known.
   * @returns Nothing.
   */
  fail(id: number, reason: string, uploadId: string | null = null): void {
    this.#update(id, (item) => ({
      ...item,
      state: 'failed',
      failure: `Failed: ${reason}`,
      uploadId: item.uploadId ?? uploadId
    }));
  }

  /**
   * Forgets every file of the previous visit.
   *
   * @returns Nothing.
   */
  clear(): void {
    this.items = [];
  }

  /**
   * Replaces one item.
   *
   * @param id The item's identity.
   * @param update The change to apply to it.
   * @returns Nothing.
   */
  #update(id: number, update: (item: UploadItem) => UploadItem): void {
    this.items = this.items.map((item) => (item.id === id ? update(item) : item));
  }
}

/** The files the running client is uploading. */
export const uploads = new UploadQueue();
