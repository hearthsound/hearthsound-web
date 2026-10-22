/**
 * Tests for reading a whole collection as a queue: the mapping every Play
 * button depends on, and the answer that means the server refused.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nativeClient } from '#lib/api/native';

import { loadCollection } from './queue-source';

/** One item the queue endpoint reports. */
const viewItem = {
  id: 'so_1',
  title: 'Nightfall',
  artist: 'The Band',
  album: 'Record',
  duration: 217,
  coverArt: 'co_1',
  availability: 'available',
  rating: 4,
  liked: true,
  disliked: false
};

/**
 * Answers the queue endpoint with the given answer.
 *
 * @param data The answer's payload, when it has one.
 * @returns The call spy.
 */
function answerWith(data: unknown) {
  return vi.spyOn(nativeClient, 'GET').mockResolvedValue({ data } as never);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('collection queue', () => {
  it('maps the server answer to the queue item shape', async () => {
    answerWith({ items: [viewItem], startIndex: 0, source: 'songs' });

    const collection = await loadCollection('songs');

    expect(collection).toEqual({
      items: [
        {
          id: 'so_1',
          title: 'Nightfall',
          artist: 'The Band',
          album: 'Record',
          albumId: null,
          artistId: null,
          coverArt: 'co_1',
          durationSecs: 217,
          liked: true,
          disliked: false,
          rating: 4
        }
      ],
      startIndex: 0
    });
  });

  it('names the album or artist of the collection it read', async () => {
    answerWith({ items: [viewItem], startIndex: 1, source: 'album:al_9' });
    expect((await loadCollection('album:al_9'))?.items[0]?.albumId).toBe('al_9');

    answerWith({ items: [viewItem], startIndex: 0, source: 'artist:ar_9' });
    expect((await loadCollection('artist:ar_9'))?.items[0]?.artistId).toBe('ar_9');

    answerWith({ items: [viewItem], startIndex: 0, source: 'artist-top:ar_9' });
    expect((await loadCollection('artist-top:ar_9'))?.items[0]?.artistId).toBe('ar_9');

    answerWith({ items: [viewItem], startIndex: 0, source: 'playlist:pl_9' });
    const playlist = await loadCollection('playlist:pl_9');
    expect(playlist?.items[0]).toMatchObject({ albumId: null, artistId: null });
  });

  it('keeps the collection order and start position', async () => {
    const second = { ...viewItem, id: 'so_2', title: 'Second' };
    answerWith({ items: [viewItem, second], startIndex: 1, source: 'songs' });

    const collection = await loadCollection('songs', 'so_2');

    expect(collection?.items.map((item) => item.id)).toEqual(['so_1', 'so_2']);
    expect(collection?.startIndex).toBe(1);
  });

  it('fills defaults for an item that reports no artist, album or rating', async () => {
    answerWith({
      items: [{ id: 'so_1', title: 'Nightfall', coverArt: 'co_1', liked: false, disliked: false }],
      startIndex: 0,
      source: 'songs'
    });

    const item = (await loadCollection('songs'))?.items[0];

    expect(item).toMatchObject({
      artist: null,
      album: null,
      durationSecs: null,
      rating: 0,
      liked: false,
      disliked: false
    });
  });

  it('answers nothing when the server refused the collection', async () => {
    vi.spyOn(nativeClient, 'GET').mockResolvedValue({
      data: undefined,
      error: { code: 'not-found', title: 'Not found' }
    } as never);

    await expect(loadCollection('album:al_missing')).resolves.toBeNull();
  });
});
