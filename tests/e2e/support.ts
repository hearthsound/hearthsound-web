/**
 * Shared helpers of the end-to-end specs.
 *
 * The specs drive the built client and seed the server through the same APIs
 * the client calls: the native client's admin routes and the Subsonic surface.
 * Everything they share - the addresses the harness recorded, the administrator
 * they create, the API calls they make and the labels they record - lives here
 * so no spec re-implements it.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { expect } from '@playwright/test';
import type { APIResponse, BrowserContext, Locator, Page } from '@playwright/test';

/** The addresses and paths the harness wrote. */
export interface E2EState {
  /** The server's origin. */
  baseUrl: string;
  /** The one-time setup link the server printed. */
  setupUrl: string;
  /** The temporary directory the server and the suite share. */
  tmpDir: string;
  /** The scanned music folder. */
  musicDir: string;
  /** The acquisition fixture's import root. */
  downloadsDir: string;
  /** The origin the scrobble fixture posts its reports to. */
  sinkUrl: string;
  /** The server configuration the scrobble fixture's instance is created with. */
  scrobbleConfig: ScrobbleFixtureConfig;
}

/** One suggested track of the scrobble fixture's discovery tables. */
export interface ScrobbleSuggestedTrack {
  /** The track title. */
  title: string;
  /** The artists credited with it. */
  artists: string[];
}

/** The scrobble fixture's server configuration, as the harness builds it. */
export interface ScrobbleFixtureConfig {
  /** The origin the fixture posts its reports to. */
  endpoint: string;
  /** How a listener links their account. */
  linkMethod: string;
  /** The tracks a similarity query suggests. */
  similarTracks: ScrobbleSuggestedTrack[];
  /** The artists a similarity query suggests. */
  similarArtists: { name: string }[];
  /** The tracks an artist's popularity query suggests. */
  topTracks: ScrobbleSuggestedTrack[];
  /** The tracks recommended to the listener. */
  recommended: ScrobbleSuggestedTrack[];
  /** The playlists the fixture reports as generated for the listener. */
  playlists: {
    /** The service's stable reference for the playlist. */
    reference: string;
    /** The playlist's name. */
    name: string;
    /** The playlist's tracks. */
    tracks: ScrobbleSuggestedTrack[];
  }[];
}

/**
 * How long a page whose stored content is still being indexed may take to show
 * it.
 *
 * The entity page answers what the server stored and runs the indexer behind
 * the request, so a page draws the hero and what it holds at once and gains the
 * rest when `entity.updated` names it. The specs wait this long for that
 * event's effect instead of expecting the discography with the first answer.
 */
export const INDEX_WAIT_MS = 30_000;

/** The account the wizard creates. */
export const ADMIN_USERNAME = 'admin';

/** The password of the account the wizard creates. */
export const ADMIN_PASSWORD = 'e2e-account-password';

/** The display name of the account the wizard creates. */
export const ADMIN_DISPLAY_NAME = 'Administrator';

/** The account the admin views create. */
export const LISTENER_USERNAME = 'listener';

/** The password of the account the admin views create. */
export const LISTENER_PASSWORD = 'e2e-listener-password';

/** The display name of the account the admin views create. */
export const LISTENER_DISPLAY_NAME = 'Listener';

/** The plugin id of the catalog fixture the search and playback specs serve from. */
export const ALBUM_CATALOG = 'com.example.album-catalog';

/** The plugin id of the acquisition fixture. */
export const ACQUISITION_FIXTURE = 'com.example.acquisition-fixture';

/** The plugin id of the scrobble and discovery fixture. */
export const SCROBBLE_FIXTURE = 'com.example.scrobble-fixture';

/** The instance slug the discovery specs give the scrobble fixture. */
export const SCROBBLE_SLUG = 'scrobble';

/** The name the scrobble fixture's manifest gives the service. */
export const SCROBBLE_DISPLAY_NAME = 'Scrobble fixture';

/** The playlist the scrobble fixture reports as generated for a linked listener. */
export const GENERATED_PLAYLIST_NAME = 'Fixture Weekly';

/** The artist the album catalog fixture credits. */
export const CATALOG_ARTIST = 'Fixture Artist';

/** The album the album catalog fixture holds. */
export const CATALOG_ALBUM = 'Fixture Album';

/** The instance slug the search and playback specs give the catalog fixture. */
export const CATALOG_SLUG = 'album';

/** The instance slug the search and playback specs give the acquisition fixture. */
export const ACQUISITION_SLUG = 'acq';

/** The instance slug the wizard gives the hello catalog fixture. */
export const HELLO_SLUG = 'hellocatalog';

/** The instance slug the wizard gives the metadata fixture. */
export const METADATA_SLUG = 'metadatafixture';

/** Reads the state the harness wrote. */
export function state(): E2EState {
  const file = path.resolve(process.cwd(), 'tests', 'e2e', '.state.json');
  return JSON.parse(readFileSync(file, 'utf8')) as E2EState;
}

/** One path relative to the server's origin. */
export function url(route: string): string {
  return new URL(route, state().baseUrl).toString();
}

/**
 * Waits for a while.
 *
 * @param milliseconds How long to wait.
 * @returns Nothing.
 */
export function sleep(milliseconds: number): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, milliseconds);
  return promise;
}

declare global {
  interface Window {
    /** The progress labels the recording spec collected, in order. */
    __e2eProgressLabels?: string[];
    /** The upload labels the upload spec collected, in order. */
    __e2eUploadLabels?: string[];
  }
}

/** The CSRF tokens already read, one per browser context. */
const tokens = new WeakMap<BrowserContext, string>();

/**
 * Returns the CSRF token of the context's session.
 *
 * @param context The browser context, whose cookie jar holds the session.
 * @returns The token.
 */
export async function csrfToken(context: BrowserContext): Promise<string> {
  const known = tokens.get(context);
  if (known !== undefined) {
    return known;
  }
  const response = await context.request.get(url('/api/v1/auth/session'));
  if (!response.ok()) {
    throw new Error(`the session read answered ${response.status()}: ${await response.text()}`);
  }
  const body = (await response.json()) as { csrfToken?: string };
  if (body.csrfToken === undefined) {
    throw new Error('the session answer carried no CSRF token');
  }
  tokens.set(context, body.csrfToken);
  return body.csrfToken;
}

/**
 * Signs the browser in as the administrator the wizard created.
 *
 * @param page The page to sign in.
 * @returns Nothing.
 */
export async function signIn(page: Page): Promise<void> {
  await signInAs(page, ADMIN_USERNAME, ADMIN_PASSWORD);
  await expect(page.locator('.app-account')).toHaveText(ADMIN_DISPLAY_NAME);
}

/**
 * Signs the browser in as one account.
 *
 * @param page The page to sign in.
 * @param username The account's sign-in name.
 * @param password The account's password.
 * @returns Nothing.
 */
export async function signInAs(page: Page, username: string, password: string): Promise<void> {
  await page.goto(`${state().baseUrl}/login`);
  await page.getByRole('heading', { name: 'Sign in' }).waitFor();
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(`${state().baseUrl}/`);
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
}

/**
 * Opens the now-playing overlay from the sidebar's Queue row.
 *
 * The queue is an overlay rather than a route (l06 C), so the row stays a link
 * whose activation the shell turns into opening the view.
 *
 * @param page The page whose queue to open.
 * @returns Nothing.
 */
export async function openNowPlaying(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Queue' }).click();
  await expect(page.locator('.hs-now-playing')).toBeVisible();
}

/**
 * Presses the centre of an element with the mouse.
 *
 * Rows carry no press handler on their cells: one covering button owns the
 * surface, and the cells let the press through. Locator clicks would be
 * rejected as intercepted, so the press is aimed at the cell's own centre,
 * exactly where a reader presses.
 *
 * @param page The page to press in.
 * @param target The cell to press.
 * @returns Nothing.
 */
export async function pressCentre(page: Page, target: Locator): Promise<void> {
  const box = await target.boundingBox();
  if (box === null) {
    throw new Error('the target has no box to press');
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Sends one native API request as the signed-in account.
 *
 * @param context The browser context, whose cookies and CSRF token the request
 *   carries.
 * @param method The HTTP method.
 * @param route The path, starting with `/`.
 * @param body The JSON body, when the call takes one.
 * @returns The response, once it answered successfully.
 */
export async function api(
  context: BrowserContext,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  route: string,
  body?: unknown
): Promise<APIResponse> {
  const headers: Record<string, string> = { 'x-hearthsound-csrf': await csrfToken(context) };
  if (body !== undefined) {
    headers['content-type'] = 'application/json';
  }
  const response = await context.request.fetch(url(route), {
    method,
    headers,
    data: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok()) {
    throw new Error(`${method} ${route} answered ${response.status()}: ${await response.text()}`);
  }
  return response;
}

/**
 * Configures a provider instance.
 *
 * @param context The browser context.
 * @param spec The instance to create.
 * @param spec.slug The instance slug.
 * @param spec.pluginId The plugin to configure it from.
 * @param spec.displayName The name the admin views show.
 * @param spec.serverConfig The plugin's server-scoped configuration.
 * @param spec.hostConfig The host-level settings.
 * @returns Nothing.
 */
export async function createProvider(
  context: BrowserContext,
  spec: {
    slug: string;
    pluginId: string;
    displayName: string;
    serverConfig: unknown;
    hostConfig: unknown;
  }
): Promise<void> {
  await api(context, 'POST', '/api/v1/admin/providers', {
    slug: spec.slug,
    pluginId: spec.pluginId,
    displayName: spec.displayName,
    serverConfig: spec.serverConfig,
    hostConfig: spec.hostConfig
  });
}

/**
 * Replaces one layer's ordered instances.
 *
 * @param context The browser context.
 * @param layer The layer to assign.
 * @param slugs The instance slugs, first is primary.
 * @returns Nothing.
 */
export async function setLayer(
  context: BrowserContext,
  layer: string,
  slugs: readonly string[]
): Promise<void> {
  // The server installs MusicBrainz itself and refuses a layer it provides that
  // does not list it, so a spec that reorders a layer keeps the required
  // instance at the end unless it already names it.
  const required = await requiredInstance(context, layer);
  const members = [...slugs];
  if (required !== null && !members.includes(required)) {
    members.push(required);
  }
  await api(context, 'PUT', `/api/v1/admin/layers/${layer}`, members);
}

/**
 * Returns the required instance a layer must keep, when the server has one.
 *
 * @param context The browser context.
 * @param layer The layer being written.
 * @returns The slug of the required instance the layer currently lists, or
 *   `null` when the layer has none or the server requires nothing there.
 */
async function requiredInstance(context: BrowserContext, layer: string): Promise<string | null> {
  const response = await api(context, 'GET', '/api/v1/admin/layers', undefined);
  const body: unknown = await response.json();
  const layers =
    typeof body === 'object' && body !== null && 'layers' in body && Array.isArray(body.layers)
      ? body.layers
      : [];
  for (const entry of layers) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'layer' in entry &&
      entry.layer === layer &&
      'instances' in entry &&
      Array.isArray(entry.instances)
    ) {
      const instances = entry.instances.filter(
        (slug: unknown): slug is string => typeof slug === 'string'
      );
      return instances.includes('musicbrainz') ? 'musicbrainz' : null;
    }
  }
  return null;
}

/** One row of the acquisition ledger. */
export interface LedgerRow {
  /** The acquisition's client id. */
  id: string;
  /** Where the acquisition is. */
  state: string;
  /** The stored track the acquisition is for. */
  trackId: string;
  /** The track's title. */
  trackTitle: string;
  /** The track's credited artist. */
  trackArtist: string;
}

/**
 * Reads the acquisition ledger.
 *
 * @param context The browser context.
 * @param state The part of the ledger to read: `active`, `recent` or `all`.
 * @returns The rows, newest first.
 */
export async function ledger(context: BrowserContext, state: string): Promise<LedgerRow[]> {
  const response = await api(context, 'GET', `/api/v1/admin/acquisitions?state=${state}`);
  const body: unknown = await response.json();
  const rows =
    typeof body === 'object' && body !== null && 'acquisitions' in body ? body.acquisitions : null;
  if (!Array.isArray(rows)) {
    return [];
  }
  return rows.flatMap((row) => {
    if (
      typeof row !== 'object' ||
      row === null ||
      !('id' in row) ||
      typeof row.id !== 'string' ||
      !('trackId' in row) ||
      typeof row.trackId !== 'string'
    ) {
      return [];
    }
    const text = (key: string): string =>
      key in row && typeof row[key] === 'string' ? row[key] : '';
    return [
      {
        id: row.id,
        state: typeof row.state === 'string' ? row.state : '',
        trackId: row.trackId,
        trackTitle: text('trackTitle'),
        trackArtist: text('trackArtist')
      }
    ];
  });
}

/**
 * Reads the instance slugs the server is configured with.
 *
 * @param context The browser context.
 * @returns The slugs, in the server's order.
 */
export async function providerSlugs(context: BrowserContext): Promise<string[]> {
  const response = await api(context, 'GET', '/api/v1/admin/providers');
  const body: unknown = await response.json();
  const providers =
    typeof body === 'object' && body !== null && 'providers' in body ? body.providers : null;
  if (!Array.isArray(providers)) {
    return [];
  }
  return providers.flatMap((provider) =>
    typeof provider === 'object' &&
    provider !== null &&
    'slug' in provider &&
    typeof provider.slug === 'string'
      ? [provider.slug]
      : []
  );
}

/**
 * Waits for the discovery sync to store the fixture's generated playlist.
 *
 * Linking a discovery service enqueues the sync, which runs in the background;
 * the specs wait for the playlist instead of assuming a delay.
 *
 * @param context The browser context.
 * @param name The generated playlist's name.
 * @param deadline How long to wait, in milliseconds.
 * @returns Nothing.
 * @throws Error when the playlist does not appear in time.
 */
export async function waitForGeneratedPlaylist(
  context: BrowserContext,
  name = GENERATED_PLAYLIST_NAME,
  deadline = 60_000
): Promise<void> {
  const start = Date.now();
  for (;;) {
    const body = await restGet(context, 'getPlaylists', {});
    const playlists =
      typeof body.playlists === 'object' && body.playlists !== null && 'playlist' in body.playlists
        ? body.playlists.playlist
        : null;
    if (
      Array.isArray(playlists) &&
      playlists.some(
        (playlist) =>
          typeof playlist === 'object' &&
          playlist !== null &&
          'name' in playlist &&
          playlist.name === name &&
          'hearthsound' in playlist &&
          typeof playlist.hearthsound === 'object' &&
          playlist.hearthsound !== null &&
          'generatedBy' in playlist.hearthsound
      )
    ) {
      return;
    }
    if (Date.now() - start > deadline) {
      throw new Error(`the discovery sync stored no playlist named ${name}`);
    }
    await sleep(500);
  }
}

/** One playlist the suite created through the Subsonic surface. */
export interface CreatedPlaylist {
  /** The playlist's client id. */
  id: string;
  /** The name it carries. */
  name: string;
  /** Its tracks in the order the server stored them. */
  entries: FoundSong[];
}

/**
 * Creates a playlist holding the given tracks.
 *
 * @param context The browser context.
 * @param name The playlist's name.
 * @param songIds The tracks to put in it, in order.
 * @returns The playlist as the server answered with it.
 * @throws Error when the server refused the write.
 */
export async function createPlaylist(
  context: BrowserContext,
  name: string,
  songIds: readonly string[]
): Promise<CreatedPlaylist> {
  const body = new URLSearchParams({ ...subsonicParams(), name });
  for (const songId of songIds) {
    body.append('songId', songId);
  }
  const response = await context.request.post(url('/rest/createPlaylist'), {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-hearthsound-csrf': await csrfToken(context)
    },
    data: body.toString()
  });
  if (!response.ok()) {
    throw new Error(`/rest/createPlaylist answered ${response.status()}: ${await response.text()}`);
  }
  const answer = envelope(await response.json(), 'createPlaylist');
  const playlist = answer.playlist;
  if (
    typeof playlist !== 'object' ||
    playlist === null ||
    !('id' in playlist) ||
    typeof playlist.id !== 'string'
  ) {
    throw new Error('/rest/createPlaylist answered no playlist');
  }
  const entries =
    'entry' in playlist && Array.isArray(playlist.entry)
      ? playlist.entry.flatMap((entry) => {
          const track = songOf(entry);
          return track === null ? [] : [track];
        })
      : [];
  return {
    id: playlist.id,
    name: 'name' in playlist && typeof playlist.name === 'string' ? playlist.name : name,
    entries
  };
}

/**
 * Reads a playlist's tracks in the order the server stored them.
 *
 * @param context The browser context.
 * @param id The playlist's client id.
 * @returns The tracks, first to last.
 */
export async function playlistEntries(context: BrowserContext, id: string): Promise<FoundSong[]> {
  const body = await restGet(context, 'getPlaylist', { id });
  const playlist = body.playlist;
  const entries =
    typeof playlist === 'object' && playlist !== null && 'entry' in playlist
      ? playlist.entry
      : null;
  return Array.isArray(entries)
    ? entries.flatMap((entry) => {
        const track = songOf(entry);
        return track === null ? [] : [track];
      })
    : [];
}

/**
 * Reads one layer's ordered instances.
 *
 * @param context The browser context.
 * @param layer The layer to read, for example `catalog`.
 * @returns The instance slugs, first is primary.
 */
export async function layerInstances(context: BrowserContext, layer: string): Promise<string[]> {
  const response = await api(context, 'GET', '/api/v1/admin/layers');
  const body: unknown = await response.json();
  const layers = typeof body === 'object' && body !== null && 'layers' in body ? body.layers : null;
  if (!Array.isArray(layers)) {
    return [];
  }
  for (const entry of layers) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'layer' in entry &&
      entry.layer === layer &&
      'instances' in entry &&
      Array.isArray(entry.instances)
    ) {
      return entry.instances.filter((slug): slug is string => typeof slug === 'string');
    }
  }
  return [];
}

/**
 * Changes one provider instance.
 *
 * @param context The browser context.
 * @param slug The instance to change.
 * @param patch The fields to change.
 * @returns Nothing.
 */
export async function patchProvider(
  context: BrowserContext,
  slug: string,
  patch: unknown
): Promise<void> {
  await api(context, 'PATCH', `/api/v1/admin/providers/${slug}`, patch);
}

/** The query parameters every Subsonic call carries. */
function subsonicParams(): Record<string, string> {
  return { f: 'json', v: '1.16.1', c: 'hearthsound-web', hearthsound: '1' };
}

/**
 * Reads one Subsonic endpoint with the session's cookie.
 *
 * @param context The browser context.
 * @param name The endpoint name, for example `search3`.
 * @param params The endpoint's parameters.
 * @returns The `subsonic-response` body.
 */
export async function restGet(
  context: BrowserContext,
  name: string,
  params: Record<string, string | number>
): Promise<Record<string, unknown>> {
  const query = new URLSearchParams({ ...subsonicParams(), ...strings(params) });
  const response = await context.request.get(url(`/rest/${name}?${query.toString()}`), {
    headers: { 'x-hearthsound-csrf': await csrfToken(context) }
  });
  if (!response.ok()) {
    throw new Error(`/rest/${name} answered ${response.status()}: ${await response.text()}`);
  }
  return envelope(await response.json(), name);
}

/**
 * Writes one Subsonic endpoint with the session's cookie and CSRF token.
 *
 * @param context The browser context.
 * @param name The endpoint name, for example `hsAcquire`.
 * @param params The endpoint's parameters.
 * @returns The `subsonic-response` body.
 */
export async function restPost(
  context: BrowserContext,
  name: string,
  params: Record<string, string | number>
): Promise<Record<string, unknown>> {
  const body = new URLSearchParams({ ...subsonicParams(), ...strings(params) });
  const response = await context.request.post(url(`/rest/${name}`), {
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'x-hearthsound-csrf': await csrfToken(context)
    },
    data: body.toString()
  });
  if (!response.ok()) {
    throw new Error(`/rest/${name} answered ${response.status()}: ${await response.text()}`);
  }
  return envelope(await response.json(), name);
}

/**
 * Converts parameter values to the strings a query or form body holds.
 *
 * @param params The parameters.
 * @returns The same parameters as strings.
 */
function strings(params: Record<string, string | number>): Record<string, string> {
  return Object.fromEntries(Object.entries(params).map(([key, value]) => [key, String(value)]));
}

/**
 * Unwraps the JSON envelope every Subsonic answer carries.
 *
 * @param body The parsed answer.
 * @param name The endpoint the answer belongs to, used in the error.
 * @returns The `subsonic-response` body.
 * @throws Error when the envelope reports a failure.
 */
function envelope(body: unknown, name: string): Record<string, unknown> {
  if (typeof body !== 'object' || body === null || !('subsonic-response' in body)) {
    throw new Error(`/rest/${name} answered no subsonic-response`);
  }
  const response = body['subsonic-response'];
  if (typeof response !== 'object' || response === null) {
    throw new Error(`/rest/${name} answered no subsonic-response`);
  }
  const answer = response as Record<string, unknown>;
  if (answer.status === 'failed') {
    const error = answer.error;
    const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : '?';
    const message =
      typeof error === 'object' && error !== null && 'message' in error
        ? error.message
        : 'no message';
    throw new Error(`/rest/${name} failed with ${String(code)}: ${String(message)}`);
  }
  return answer;
}

/** One track a search answered with. */
export interface FoundSong {
  /** The client id the answer named. */
  id: string;
  /** The title the answer named. */
  title: string;
  /** The availability the vendor member reported, when one was carried. */
  availability?: string;
}

/**
 * Searches the library and the catalogues for tracks.
 *
 * @param context The browser context.
 * @param query The query to search for.
 * @returns The tracks the answer carried, in the server's order.
 */
/** One artist the native search answered. */
export interface NativeArtist {
  /** The artist's client id. */
  id: string;
  /** The display name. */
  name: string;
  /** Whether the server holds a portrait. */
  hasImage: boolean;
  /** Whether the caller's personal library holds the artist. */
  inLibrary: boolean;
  /** The relevance score, when the answer carries one. */
  score?: number;
}

/** One album the native search answered. */
export interface NativeAlbum {
  /** The album's client id. */
  id: string;
  /** The title. */
  title: string;
  /** The edition label, when the release states one. */
  edition: string | null;
  /** The release year. */
  year: number | null;
  /** The release type. */
  albumType: string | null;
  /** The display artist. */
  displayArtist: string | null;
  /** The primary artist's client id. */
  artistId: string | null;
  /** Whether the server holds a cover. */
  hasImage: boolean;
  /** Whether the caller's personal library holds the album. */
  inLibrary: boolean;
}

/** One track the native search answered. */
export interface NativeTrack {
  /** The track's client id. */
  id: string;
  /** The title. */
  title: string;
  /** The credited artists. */
  artists: { id: string; name: string }[];
  /** The album's client id, when the track has an album. */
  albumId: string | null;
  /** The album's title, when the track has an album. */
  albumTitle: string | null;
  /** The track's availability. */
  availability: string;
  /** Whether the caller's personal library holds the track. */
  inLibrary: boolean;
}

/** One native search's answer. */
export interface NativeSearch {
  /** Matching artists, best first. */
  artists: NativeArtist[];
  /** Matching albums, best first. */
  albums: NativeAlbum[];
  /** Matching tracks, best first. */
  tracks: NativeTrack[];
  /** The continuation of a one-kind answer. */
  nextCursor: string | null;
}

/**
 * Runs one search through the native API.
 *
 * @param context The browser context, signed in.
 * @param query The text to search for.
 * @param kinds The kinds to return, comma separated.
 * @param limit The most hits per kind.
 * @returns The answer's entities.
 */
export async function nativeSearch(
  context: BrowserContext,
  query: string,
  kinds = 'artists,albums,tracks',
  limit = 60
): Promise<NativeSearch> {
  const params = new URLSearchParams({ q: query, kinds, limit: String(limit) });
  const response = await api(context, 'GET', `/api/v1/search?${params.toString()}`);
  const body = (await response.json()) as Partial<NativeSearch>;
  return {
    artists: body.artists ?? [],
    albums: body.albums ?? [],
    tracks: body.tracks ?? [],
    nextCursor: body.nextCursor ?? null
  };
}

export async function searchSongs(context: BrowserContext, query: string): Promise<FoundSong[]> {
  const body = await restGet(context, 'search3', {
    query,
    songCount: 60,
    artistCount: 0,
    albumCount: 0
  });
  const result = body.searchResult3;
  if (typeof result !== 'object' || result === null || !('song' in result)) {
    return [];
  }
  const songs = result.song;
  return Array.isArray(songs)
    ? songs.flatMap((song) => {
        const track = songOf(song);
        return track === null ? [] : [track];
      })
    : [];
}

/**
 * Reads one named album from the catalog with the tracks it holds.
 *
 * The album is read through the catalog while it is still unmaterialized: an
 * album the server already stores is represented by its stored entity instead
 * of a catalog reference, so a search does not list it as a catalog album.
 *
 * @param context The browser context.
 * @param title The album's title, as the catalog reports it.
 * @returns The album's client id and its tracks, in the album's order.
 * @throws Error when no catalog album of that name answers.
 */
export async function catalogAlbum(
  context: BrowserContext,
  title: string
): Promise<{ id: string; tracks: FoundSong[] }> {
  const found = await restGet(context, 'search3', {
    query: title,
    songCount: 0,
    albumCount: 12,
    artistCount: 0
  });
  const search = found.searchResult3;
  const albums =
    typeof search === 'object' && search !== null && 'album' in search ? search.album : undefined;
  const albumId = Array.isArray(albums)
    ? albums.reduce<string | null>((known, album) => known ?? namedEntityId(album, title), null)
    : null;
  if (albumId === null) {
    throw new Error(`the catalog answered no album named ${title}`);
  }
  const detail = await restGet(context, 'getAlbum', { id: albumId });
  const album = detail.album;
  const songs =
    typeof album === 'object' && album !== null && 'song' in album ? album.song : undefined;
  return {
    id: albumId,
    tracks: Array.isArray(songs)
      ? songs.flatMap((song) => {
          const track = songOf(song);
          return track === null ? [] : [track];
        })
      : []
  };
}

/**
 * Generates the audio a simulated download serves into the import root.
 *
 * The acquisition fixture reports the files its import root holds, so a spec
 * that expects a download to complete writes the file first. The audio lasts as
 * long as the catalog's tracks claim, which the verification of an imported file
 * compares against.
 *
 * @param fileName The name the file takes in the import root.
 * @returns Nothing.
 */
export function placeDownloadAudio(fileName: string): void {
  execFileSync(
    'ffmpeg',
    [
      '-loglevel',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:duration=180',
      '-metadata',
      'title=Download Candidate',
      '-metadata',
      'artist=Fixture Artist',
      '-c:a',
      'flac',
      path.join(state().downloadsDir, fileName)
    ],
    { stdio: 'pipe' }
  );
}

/**
 * Reads one track out of a browse answer.
 *
 * @param value The track, as the answer carried it.
 * @returns The id, the title and the vendor member's availability, or `null`
 *   when the answer named no track.
 */
function songOf(value: unknown): FoundSong | null {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('id' in value) ||
    typeof value.id !== 'string'
  ) {
    return null;
  }
  const title =
    'title' in value && typeof value.title === 'string'
      ? value.title
      : 'name' in value && typeof value.name === 'string'
        ? value.name
        : '';
  const member =
    'hearthsound' in value &&
    typeof value.hearthsound === 'object' &&
    value.hearthsound !== null &&
    'availability' in value.hearthsound &&
    typeof value.hearthsound.availability === 'string'
      ? value.hearthsound.availability
      : undefined;
  return { id: value.id, title, availability: member };
}

/**
 * Returns the id of an entity the answer named `name`.
 *
 * @param value The entity, as a browse answer carried it.
 * @param name The name to match.
 * @returns The id, or `null` when the entity carries another name or no id.
 */
function namedEntityId(value: unknown, name: string): string | null {
  if (typeof value !== 'object' || value === null || !('name' in value) || value.name !== name) {
    return null;
  }
  return 'id' in value && typeof value.id === 'string' ? value.id : null;
}

/**
 * Reads what the server knows about one entity.
 *
 * @param context The browser context.
 * @param id The entity's client id.
 * @returns The availability the server reported, or `null` when it reported
 *   none.
 */
export async function availabilityOf(context: BrowserContext, id: string): Promise<string | null> {
  const body = await restGet(context, 'hsGetAvailability', { id });
  const list = body.availabilities;
  if (typeof list !== 'object' || list === null || !('availability' in list)) {
    return null;
  }
  const entries = list.availability;
  if (!Array.isArray(entries)) {
    return null;
  }
  for (const entry of entries) {
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'id' in entry &&
      entry.id === id &&
      'state' in entry &&
      typeof entry.state === 'string'
    ) {
      return entry.state;
    }
  }
  return null;
}

/**
 * Waits until the scanned music folder's tracks are in the library.
 *
 * @param context The browser context.
 * @param expected How many tracks the folder holds.
 * @returns Nothing.
 * @throws Error when the tracks do not appear in time.
 */
export async function waitForLibrary(context: BrowserContext, expected = 3): Promise<void> {
  const deadline = Date.now() + 60_000;
  for (;;) {
    const songs = await searchSongs(context, 'Test');
    const local = songs.filter(
      (song) => song.availability === 'local' || song.availability === 'cached'
    );
    if (local.length >= expected) {
      return;
    }
    if (Date.now() > deadline) {
      const listed = songs.map((song) => `${song.title} (${song.availability ?? 'unscored'})`);
      throw new Error(
        `the library listed ${local.length} of ${expected} scanned tracks: ${listed.join(', ')}`
      );
    }
    await sleep(500);
  }
}

/**
 * Starts recording the progress labels the player bar shows.
 *
 * The labels change faster than Playwright can poll, so the page records every
 * distinct one as the player renders it.
 *
 * @param page The page to record in.
 * @returns Nothing.
 */
export async function recordProgressLabels(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: string[] = [];
    window.__e2eProgressLabels = seen;
    const read = (): void => {
      const text = document.querySelector('.player-progress')?.textContent?.trim() ?? '';
      if (text !== '' && seen[seen.length - 1] !== text) {
        seen.push(text);
      }
    };
    read();
    const region = document.querySelector('[aria-label="Player"]') ?? document.body;
    new MutationObserver(read).observe(region, {
      subtree: true,
      childList: true,
      characterData: true
    });
  });
}

/**
 * Returns the progress labels the player bar showed since recording started.
 *
 * @param page The page that recorded them.
 * @returns The labels, in the order they appeared.
 */
export function progressLabels(page: Page): Promise<string[]> {
  return page.evaluate(() => window.__e2eProgressLabels ?? []);
}
