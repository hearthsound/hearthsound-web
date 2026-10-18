/**
 * Tests for the stream decision: the stored file when the browser plays it, the
 * transcode when it does not.
 */
import { describe, expect, it } from 'vitest';

import { streamSource, streamUrl } from './stream';

/**
 * Reads a media URL into its parts.
 *
 * @param url The URL to read.
 * @returns The parsed URL.
 */
function parse(url: string): URL {
  return new URL(url, 'http://localhost');
}

describe('stream URLs', () => {
  it('asks for the stored file as it is', () => {
    const url = parse(streamUrl('tr_1', 'raw'));

    expect(url.pathname).toBe('/rest/stream');
    expect(url.searchParams.get('id')).toBe('tr_1');
    expect(url.searchParams.get('format')).toBe('raw');
    expect(url.searchParams.get('maxBitRate')).toBeNull();
    expect(url.searchParams.get('f')).toBe('json');
    expect(url.searchParams.get('v')).toBe('1.16.1');
    expect(url.searchParams.get('c')).toBe('hearthsound-web');
  });

  it('caps the bitrate of the transcode', () => {
    const url = parse(streamUrl('tr_1', 'mp3'));

    expect(url.searchParams.get('format')).toBe('mp3');
    expect(url.searchParams.get('maxBitRate')).toBe('320');
  });
});

describe('stream source', () => {
  it('streams a stored file the browser plays', () => {
    const source = streamSource({ id: 'tr_1', contentType: 'audio/flac' }, () => 'probably');

    expect(source.format).toBe('raw');
    expect(parse(source.url).searchParams.get('format')).toBe('raw');
  });

  it('transcodes a file the browser does not play', () => {
    const source = streamSource({ id: 'tr_1', contentType: 'audio/flac' }, () => '');

    expect(source.format).toBe('mp3');
    expect(parse(source.url).searchParams.get('format')).toBe('mp3');
  });

  it('transcodes a track whose file does not exist yet', () => {
    expect(streamSource({ id: 'x_deezer_t_1', contentType: '' }, () => 'probably').format).toBe(
      'mp3'
    );
    expect(streamSource({ id: 'x_deezer_t_1' }, () => 'probably').format).toBe('mp3');
  });
});
