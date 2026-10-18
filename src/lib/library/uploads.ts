/**
 * The uploads listing, read from the native API.
 *
 * The listing is a native endpoint rather than a Subsonic one: it answers the
 * caller's own uploads with the cursor the next page is asked for by. A track
 * it reports carries the client id `/rest/getSong` and `/rest/stream` accept,
 * so an uploaded file is played like any other track.
 */
import { nativeClient } from '#lib/api/native';
import type { components } from '#lib/api/schema';

/** One track the caller uploaded, as the listing reports it. */
export type UploadedTrack = components['schemas']['UploadedTrackView'];

/** The outcome of one file the server received. */
export type UploadEntry = components['schemas']['UploadEntry'];

/** How many uploads one page of the listing holds. */
export const UPLOADS_PAGE_SIZE = 60;

/** The path the native uploads endpoint is served from. */
export const UPLOADS_PATH = '/api/v1/uploads';

/** One page of the uploads listing. */
export interface UploadPage {
  /** The uploaded tracks, newest first. */
  tracks: UploadedTrack[];
  /** The cursor of the next page, or `null` when this was the last one. */
  nextCursor: string | null;
}

/**
 * Reads one page of the caller's own uploads.
 *
 * @param cursor The cursor the previous page answered with, or `null` for the
 *   first page.
 * @returns The page.
 * @throws Error when the server refused the read.
 */
export async function listUploads(cursor: string | null): Promise<UploadPage> {
  const answer = await nativeClient.GET('/api/v1/uploads', {
    params: { query: { limit: UPLOADS_PAGE_SIZE, cursor: cursor ?? undefined } }
  });
  if (answer.error !== undefined) {
    throw new Error(answer.error.detail ?? answer.error.title);
  }
  return {
    tracks: answer.data?.tracks ?? [],
    nextCursor: answer.data?.nextCursor ?? null
  };
}
