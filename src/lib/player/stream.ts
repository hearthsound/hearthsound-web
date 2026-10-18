/**
 * The media URLs the player and its views hand to the browser.
 *
 * Audio and images are fetched by the element itself, so they are plain
 * same-origin URLs authenticated by the session cookie; they live here because
 * the raw-versus-transcoded decision is the player's, and the cover art beside
 * it is the same kind of URL.
 */
import { subsonic } from '#lib/subsonic/client';

/** The forms of a stream the client asks for. */
export type StreamFormat = 'raw' | 'mp3';

/** A stream the player can hand to its audio element. */
export interface StreamSource {
  /** The URL of the stream. */
  url: string;
  /** The form that URL asks the server for. */
  format: StreamFormat;
}

/** The track fields the stream decision reads. */
export interface StreamTrack {
  /** The track's client id. */
  id: string;
  /** The MIME type of the stored file, empty while no file exists. */
  contentType?: string | null;
}

/** The bitrate cap of the transcoded fallback, in kilobits per second. */
export const TRANSCODE_MAX_BITRATE_KBPS = 320;

/** The cover art size the player asks for, in pixels. */
export const COVER_ART_SIZE = 512;

/**
 * Builds the URL of a stream.
 *
 * @param id The track's client id.
 * @param format The form to ask for: the stored file, or a transcoded MP3.
 * @returns The same-origin stream URL.
 */
export function streamUrl(id: string, format: StreamFormat): string {
  return format === 'raw'
    ? subsonic.binaryUrl('stream', { id, format: 'raw' })
    : subsonic.binaryUrl('stream', {
        id,
        format: 'mp3',
        maxBitRate: TRANSCODE_MAX_BITRATE_KBPS
      });
}

/**
 * Chooses how to stream a track.
 *
 * A stored file the browser can play is streamed as it is; anything else, which
 * includes a track whose file does not exist yet, is requested as an MP3 the
 * server transcodes, and the player falls back to that form when a raw stream
 * fails.
 *
 * @param track The track to stream.
 * @param canPlayType The browser's answer for a MIME type, as
 *   `HTMLMediaElement.canPlayType` gives it.
 * @returns The stream to load.
 */
export function streamSource(
  track: StreamTrack,
  canPlayType: (type: string) => string
): StreamSource {
  const contentType = track.contentType ?? '';
  const raw = contentType !== '' && canPlayType(contentType) !== '';
  return raw
    ? { url: streamUrl(track.id, 'raw'), format: 'raw' }
    : { url: streamUrl(track.id, 'mp3'), format: 'mp3' };
}

/**
 * Builds the URL of a cover image.
 *
 * @param id The id to pass to `getCoverArt`.
 * @param size The requested size in pixels.
 * @returns The same-origin cover art URL.
 */
export function coverArtUrl(id: string, size: number = COVER_ART_SIZE): string {
  return subsonic.binaryUrl('getCoverArt', { id, size });
}
