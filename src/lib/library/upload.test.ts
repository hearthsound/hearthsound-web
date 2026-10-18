/**
 * Tests for the upload queue: what each state shows, how the progress of one
 * file is recorded, and how an answer and an event land on the right file.
 */
import { describe, expect, it } from 'vitest';

import { UploadQueue, uploadLabel } from './upload.svelte';
import type { UploadItem } from './upload.svelte';

/**
 * Returns the label of the only queued file.
 *
 * @param queue The queue to read.
 * @returns The label the page would show.
 */
function labelOf(queue: UploadQueue): string {
  return uploadLabel(queue.items[0]);
}

describe('upload labels', () => {
  it('describes every state', () => {
    const base: UploadItem = {
      id: 1,
      fileName: 'song.flac',
      state: 'queued',
      percent: 0,
      uploadId: null,
      failure: null
    };

    expect(uploadLabel(base)).toBe('Waiting');
    expect(uploadLabel({ ...base, state: 'uploading', percent: 42.7 })).toBe('Uploading 42%');
    expect(uploadLabel({ ...base, state: 'processing' })).toBe('Processing');
    expect(uploadLabel({ ...base, state: 'done' })).toBe('Done');
    expect(uploadLabel({ ...base, state: 'failed', failure: 'Too large' })).toBe('Too large');
    expect(uploadLabel({ ...base, state: 'failed' })).toBe('Failed');
  });
});

describe('upload queue', () => {
  it('adds every file waiting and in order', () => {
    const queue = new UploadQueue();

    const added = queue.add([{ name: 'one.flac' }, { name: 'two.flac' }]);

    expect(added.map((item) => item.fileName)).toEqual(['one.flac', 'two.flac']);
    expect(queue.items.map((item) => item.state)).toEqual(['queued', 'queued']);
    expect(labelOf(queue)).toBe('Waiting');
  });

  it('follows one file from its request to its answer', () => {
    const queue = new UploadQueue();
    const [item] = queue.add([{ name: 'one.flac' }]);

    queue.start(item.id);
    expect(labelOf(queue)).toBe('Uploading 0%');

    queue.progress(item.id, 40);
    expect(labelOf(queue)).toBe('Uploading 40%');

    queue.progress(item.id, 240);
    expect(labelOf(queue)).toBe('Uploading 100%');

    queue.processing('up_1');
    expect(labelOf(queue)).toBe('Processing');
    expect(queue.items[0].uploadId).toBe('up_1');

    queue.finish(item.id, { state: 'completed', uploadId: 'up_1' });
    expect(labelOf(queue)).toBe('Done');
  });

  it('keeps the progress of one file out of another', () => {
    const queue = new UploadQueue();
    const [first, second] = queue.add([{ name: 'one.flac' }, { name: 'two.flac' }]);

    queue.start(first.id);
    queue.start(second.id);
    queue.progress(second.id, 80);

    expect(uploadLabel(queue.items[0])).toBe('Uploading 0%');
    expect(uploadLabel(queue.items[1])).toBe('Uploading 80%');
  });

  it('gives an event that names no known upload to the file still sending', () => {
    const queue = new UploadQueue();
    const [first, second] = queue.add([{ name: 'one.flac' }, { name: 'two.flac' }]);
    queue.start(first.id);
    queue.start(second.id);

    queue.processing('up_9');

    expect(queue.items[0].state).toBe('processing');
    expect(queue.items[1].state).toBe('uploading');
  });

  it('gives an event to the file its upload id names, even after the answer', () => {
    const queue = new UploadQueue();
    const [first, second] = queue.add([{ name: 'one.flac' }, { name: 'two.flac' }]);
    queue.finish(first.id, { state: 'completed', uploadId: 'up_1' });
    queue.finish(second.id, { state: 'completed', uploadId: 'up_2' });

    queue.processing('up_2');

    expect(uploadLabel(queue.items[0])).toBe('Done');
    expect(uploadLabel(queue.items[1])).toBe('Done');
  });

  it('records a refused file with the reason the answer gave', () => {
    const queue = new UploadQueue();
    const [item] = queue.add([{ name: 'one.flac' }]);

    queue.finish(item.id, {
      state: 'failed',
      uploadId: 'up_1',
      error: 'unsupported-media',
      detail: 'the file is not audio'
    });

    expect(labelOf(queue)).toBe('Failed: the file is not audio');
  });

  it('says a file was too large when the server answered 413', () => {
    const queue = new UploadQueue();
    const [item] = queue.add([{ name: 'big.flac' }]);

    queue.tooLarge(item.id);

    expect(labelOf(queue)).toBe('Too large');
  });

  it('forgets the files of the previous visit', () => {
    const queue = new UploadQueue();
    queue.add([{ name: 'one.flac' }]);

    queue.clear();

    expect(queue.items).toEqual([]);
  });
});
