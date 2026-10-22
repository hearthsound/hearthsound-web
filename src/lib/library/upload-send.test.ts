/**
 * Tests for the upload orchestration: what each answer makes of the file's row.
 */
import { describe, expect, it, vi } from 'vitest';

import { UploadQueue, uploadLabel } from './upload.svelte';
import { beginUpload, sendFiles } from './upload-send';
import type { UploadTransport } from './upload-send';

/** One file, enough for the transport to receive. */
const file = new File(['bytes'], 'song.flac');

/**
 * Adds one file to a fresh queue and returns its row.
 *
 * @param queue The queue to add to.
 * @returns The added row.
 */
function queueOne(queue: UploadQueue) {
  const [item] = queue.add([{ name: file.name }]);
  if (item === undefined) {
    throw new Error('the queue did not add the file');
  }
  return item;
}

describe('beginUpload', () => {
  it('records the server entry of a stored file', async () => {
    const queue = new UploadQueue();
    const item = queueOne(queue);
    const send: UploadTransport = async () => ({
      status: 201,
      entries: [{ fileName: 'song.flac', state: 'completed', uploadId: 'up_1' }]
    });

    const entry = await beginUpload(item.id, file, 'token', queue, send);

    expect(entry).toEqual({ fileName: 'song.flac', state: 'completed', uploadId: 'up_1' });
    expect(queue.items[0]).toMatchObject({ state: 'done', percent: 100, uploadId: 'up_1' });
    expect(uploadLabel(queue.items[0]!)).toBe('Done');
  });

  it('reads a refused 413 as too large', async () => {
    const queue = new UploadQueue();
    const item = queueOne(queue);

    const entry = await beginUpload(item.id, file, null, queue, async () => ({
      status: 413,
      entries: []
    }));

    expect(entry).toBeNull();
    expect(uploadLabel(queue.items[0]!)).toBe('Too large');
  });

  it('names the status of any other HTTP failure', async () => {
    const queue = new UploadQueue();
    const item = queueOne(queue);

    await beginUpload(item.id, file, null, queue, async () => ({ status: 500, entries: [] }));

    expect(uploadLabel(queue.items[0]!)).toBe('Failed: the server answered HTTP 500');
  });

  it('fails a successful answer that named no file', async () => {
    const queue = new UploadQueue();
    const item = queueOne(queue);

    await beginUpload(item.id, file, null, queue, async () => ({ status: 201, entries: [] }));

    expect(uploadLabel(queue.items[0]!)).toBe('Failed: the server answered nothing about the file');
  });

  it('keeps the transport reason when the request never completed', async () => {
    const queue = new UploadQueue();
    const item = queueOne(queue);

    await beginUpload(item.id, file, null, queue, async () => {
      throw new Error('the server could not be reached');
    });

    expect(uploadLabel(queue.items[0]!)).toBe('Failed: the server could not be reached');
  });

  it('has a fallback when the request threw without a reason', async () => {
    const queue = new UploadQueue();
    const item = queueOne(queue);

    await beginUpload(item.id, file, null, queue, async () => {
      throw new Error('');
    });

    expect(uploadLabel(queue.items[0]!)).toBe('Failed: the upload did not go through');
  });
});

describe('sendFiles', () => {
  it('queues every file and reports the stored entries', async () => {
    const queue = new UploadQueue();
    const queued = vi.fn();
    const finished = vi.fn();
    const send: UploadTransport = async (sent) => ({
      status: 201,
      entries: [{ fileName: sent.name, state: 'completed', uploadId: sent.name }]
    });

    sendFiles([file, new File(['b'], 'other.mp3')], null, queue, queued, finished, send);
    await vi.waitFor(() => expect(finished).toHaveBeenCalledTimes(2));

    expect(queue.items.map((item) => item.fileName)).toEqual(['song.flac', 'other.mp3']);
    expect(queued).toHaveBeenCalledTimes(2);
    expect(finished.mock.calls.map(([entry]) => entry.uploadId)).toEqual([
      'song.flac',
      'other.mp3'
    ]);
  });
});
