/**
 * The listening services, the shelves they fill and the playlist edits.
 *
 * The harness installs the scrobble fixture and names the album catalog
 * fixture's artist, album and songs in its discovery tables. This spec puts the
 * two in service: the album catalog becomes the catalog layer's primary, the
 * fixture joins the scrobble and discovery layers, and the account links with
 * the token the fixture accepts, which enqueues the discovery sync.
 *
 * Connected Services reports the account the fixture named, disconnects and
 * links again through the form; Home draws Recommended Albums, Because You
 * Listen to and Generated Playlists and never Mood Playlists; a playlist
 * reorder survives the reload; an album's Add to Playlist adds every track;
 * and the Top Result is the artist the query names.
 *
 * The suite runs in file order: the account, the music folder and the catalog
 * instance exist from the earlier specs.
 */
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

import {
  ALBUM_CATALOG,
  CATALOG_ALBUM,
  CATALOG_ARTIST,
  CATALOG_SLUG,
  INDEX_WAIT_MS,
  GENERATED_PLAYLIST_NAME,
  HELLO_SLUG,
  SCROBBLE_DISPLAY_NAME,
  SCROBBLE_FIXTURE,
  SCROBBLE_SLUG,
  api,
  createPlaylist,
  createProvider,
  playlistEntries,
  providerSlugs,
  restGet,
  searchSongs,
  setLayer,
  signIn,
  state,
  waitForGeneratedPlaylist,
  waitForLibrary
} from './support';

/** The token the fixture accepts and the account it names. */
const GOOD_TOKEN = 'good';

/** The account the fixture reports for that token. */
const LINKED_ACCOUNT = 'fixture-user';

/** The artist credited on the scanned tracks, which the play seeds the shelf with. */
const SEED_ARTIST = 'Test Artist';

/**
 * Puts the catalog and scrobble fixtures in service and links the account.
 *
 * The catalog fixture becomes the catalog layer's primary, because a layer
 * searches through its first instance and the suggestions resolve against the
 * album catalog. Linking a discovery service enqueues the sync, so the
 * generated playlist exists by the time this returns.
 *
 * @param context The browser context of the signed-in administrator.
 * @returns Nothing.
 */
async function seedDiscovery(context: BrowserContext): Promise<void> {
  const slugs = await providerSlugs(context);
  if (!slugs.includes(CATALOG_SLUG)) {
    await createProvider(context, {
      slug: CATALOG_SLUG,
      pluginId: ALBUM_CATALOG,
      displayName: 'Album catalog',
      serverConfig: {},
      hostConfig: null
    });
  }
  if (!slugs.includes(SCROBBLE_SLUG)) {
    await createProvider(context, {
      slug: SCROBBLE_SLUG,
      pluginId: SCROBBLE_FIXTURE,
      displayName: SCROBBLE_DISPLAY_NAME,
      serverConfig: state().scrobbleConfig,
      hostConfig: null
    });
  }
  await setLayer(context, 'catalog', [CATALOG_SLUG, HELLO_SLUG]);
  await setLayer(context, 'scrobble', [SCROBBLE_SLUG]);
  await setLayer(context, 'discovery', [SCROBBLE_SLUG]);

  const services = await api(context, 'GET', '/api/v1/me/providers');
  const body: unknown = await services.json();
  const providers =
    typeof body === 'object' && body !== null && 'providers' in body ? body.providers : null;
  const linked =
    Array.isArray(providers) &&
    providers.some(
      (provider) =>
        typeof provider === 'object' &&
        provider !== null &&
        'slug' in provider &&
        provider.slug === SCROBBLE_SLUG &&
        'linked' in provider &&
        provider.linked === true
    );
  if (!linked) {
    await api(context, 'PUT', `/api/v1/me/providers/${SCROBBLE_SLUG}/config`, {
      config: { token: GOOD_TOKEN }
    });
  }
  await waitForGeneratedPlaylist(context);
}

/**
 * Signs in and seeds the services for one test.
 *
 * @param page The page to sign in.
 * @param context The browser context.
 * @returns Nothing.
 */
async function prepare(page: Page, context: BrowserContext): Promise<void> {
  await signIn(page);
  await waitForLibrary(context);
  await seedDiscovery(context);
}

/**
 * Returns the titles of the playlist rows in the order the page draws them.
 *
 * @param page The page showing the playlist.
 * @returns The titles.
 */
async function rowTitles(page: Page): Promise<string[]> {
  const labels = await page
    .locator('.hs-track-list.songs .hs-track-row__open')
    .evaluateAll((rows) => rows.map((row) => row.getAttribute('aria-label') ?? ''));
  return labels.map((label) => label.split(',')[0] ?? '');
}

test('Connected Services reports the linked account, disconnects and links again', async ({
  page,
  context
}) => {
  await prepare(page, context);

  // The account menu is the entry point.
  await page.locator('.app-account').click();
  await page.getByRole('menuitem', { name: 'Connected Services', exact: true }).click();
  await expect(page).toHaveURL(`${state().baseUrl}/account/services`);

  await expect(page.getByRole('heading', { name: 'Connected Services' })).toBeVisible();
  const service = page.getByRole('region', { name: SCROBBLE_DISPLAY_NAME, exact: true });
  await expect(service.getByText('Scrobbling, Recommendations')).toBeVisible();
  await expect(service.getByText(`Connected as ${LINKED_ACCOUNT}`)).toBeVisible();

  // Disconnecting asks first, then forgets the link.
  await service.getByRole('button', { name: 'Disconnect', exact: true }).click();
  const confirm = page.getByRole('alertdialog', {
    name: `Disconnect ${SCROBBLE_DISPLAY_NAME}?`
  });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Disconnect', exact: true }).click();
  await expect(service.getByText('Not connected')).toBeVisible();

  // The configuration form links the account again.
  await service.getByLabel('Token', { exact: true }).fill(GOOD_TOKEN);
  await service.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(service.getByText(`Connected as ${LINKED_ACCOUNT}`)).toBeVisible();

  // A linked form opens on the masked token, and Save waits for an edit: the
  // stored token never comes back, so an untouched form must not send it.
  await expect(service.getByLabel('Token', { exact: true })).toHaveValue('[sealed]');
  await expect(service.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
});

test('Home draws the Discovery shelves and never Mood Playlists', async ({ page, context }) => {
  await prepare(page, context);

  // One play gives the Because You Listen to shelf its seed.
  const songs = await searchSongs(context, 'Test Song');
  const played = songs.find(
    (song) => song.availability === 'local' || song.availability === 'cached'
  );
  if (played === undefined) {
    throw new Error('the library listed no scanned track to play');
  }
  await restGet(context, 'scrobble', { id: played.id });

  await page.goto(`${state().baseUrl}/`);
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();

  const recommended = page.getByRole('region', { name: 'Recommended Albums', exact: true });
  await expect(
    recommended.getByRole('link', { name: new RegExp(`^${CATALOG_ALBUM}`) })
  ).toBeVisible();

  const because = page.getByRole('region', {
    name: `Because You Listen to ${SEED_ARTIST}`,
    exact: true
  });
  await expect(because.getByRole('link', { name: new RegExp(`^${CATALOG_ALBUM}`) })).toBeVisible();

  const generated = page.getByRole('region', { name: 'Generated Playlists', exact: true });
  await expect(
    generated.getByRole('link', { name: new RegExp(`^${GENERATED_PLAYLIST_NAME}`) })
  ).toBeVisible();

  // Mood Playlists has no source and stays hidden even though it is enabled.
  await expect(page.getByRole('region', { name: 'Mood Playlists', exact: true })).toHaveCount(0);
});

test('a playlist reorder is stored and survives a reload', async ({ page, context }) => {
  await signIn(page);
  await waitForLibrary(context);

  const songs = await searchSongs(context, 'Test Song');
  const local = songs
    .filter((song) => song.availability === 'local' || song.availability === 'cached')
    .slice(0, 3);
  expect(local).toHaveLength(3);
  const playlist = await createPlaylist(
    context,
    'Reorder Playlist',
    local.map((song) => song.id)
  );
  const [first, second, third] = local.map((song) => song.title);

  await page.goto(`${state().baseUrl}/playlist/${playlist.id}`);
  await expect(page.getByRole('heading', { name: 'Reorder Playlist', exact: true })).toBeVisible();
  await expect(page.locator('.hs-track-row')).toHaveCount(3);

  await page.getByRole('button', { name: 'More Actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Reorder', exact: true }).click();
  const rows = page.getByRole('list', { name: 'Playlist songs' }).locator('li');
  await expect(rows).toHaveCount(3);

  // The first row moves below the second with the keyboard, then Done saves.
  await rows.first().focus();
  await page.keyboard.press(' ');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press(' ');
  await page.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Done', exact: true })).toHaveCount(0);

  const stored = await playlistEntries(context, playlist.id);
  expect(stored.map((entry) => entry.title)).toEqual([second, first, third]);
  await expect.poll(() => rowTitles(page)).toEqual([second, first, third]);

  // The order is the server's, so a reload draws the same rows.
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Reorder Playlist', exact: true })).toBeVisible();
  await expect.poll(() => rowTitles(page)).toEqual([second, first, third]);
});

test('an album is added to a playlist in one step', async ({ page, context }) => {
  await prepare(page, context);

  const playlist = await createPlaylist(context, 'Album Picks', []);
  const answer = await restGet(context, 'hsGetRecommendedAlbums', { size: 10 });
  const recommended =
    typeof answer.recommendedAlbums === 'object' &&
    answer.recommendedAlbums !== null &&
    'album' in answer.recommendedAlbums
      ? answer.recommendedAlbums.album
      : null;
  const album = Array.isArray(recommended)
    ? recommended.find(
        (entry) =>
          typeof entry === 'object' &&
          entry !== null &&
          'name' in entry &&
          entry.name === CATALOG_ALBUM &&
          'id' in entry &&
          typeof entry.id === 'string'
      )
    : undefined;
  if (
    album === undefined ||
    typeof album !== 'object' ||
    album === null ||
    !('id' in album) ||
    typeof album.id !== 'string'
  ) {
    throw new Error(`the recommendations named no album called ${CATALOG_ALBUM}`);
  }

  await page.goto(`${state().baseUrl}/album/${album.id}`);
  // The album's hero is there with the first answer; its tracklist arrives with
  // the indexer, and the page never claims the album has no songs while
  // it waits.
  await expect(page.getByRole('heading', { name: CATALOG_ALBUM, exact: true })).toBeVisible({
    timeout: INDEX_WAIT_MS
  });
  await expect(page.getByText('This album has no songs.')).toHaveCount(0);
  await expect(page.locator('.hs-track-list.tracks .hs-track-row')).toHaveCount(5, {
    timeout: INDEX_WAIT_MS
  });

  await page.getByRole('button', { name: 'More Actions', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Add to Playlist', exact: true }).click();
  const [addResponse] = await Promise.all([
    page.waitForResponse(
      (response) => response.request().method() === 'POST' && response.url().includes('/tracks')
    ),
    page
      .getByRole('menu', { name: 'Add to Playlist' })
      .getByRole('menuitem', { name: 'Album Picks', exact: true })
      .click()
  ]);
  expect(await addResponse.json()).toEqual({ added: 5, trackCount: 5 });
  await expect(page.getByText('Added to Album Picks.')).toBeVisible();

  const stored = await playlistEntries(context, playlist.id);
  expect(stored.map((entry) => entry.title)).toEqual([
    'Fixture Song 1',
    'Fixture Song 2',
    'Fixture Song 3',
    'Fixture Song 4',
    'Fixture Song 5'
  ]);
});

test('the Top Result is the artist the query names', async ({ page, context }) => {
  await prepare(page, context);

  await page.goto(`${state().baseUrl}/search`);
  await page.locator('.app-search').getByLabel('Search', { exact: true }).fill(CATALOG_ARTIST);

  const card = page.locator('.top-result .hs-top-result');
  await expect(card).toBeVisible();
  await expect(
    card.getByRole('link', { name: `${CATALOG_ARTIST}, Artist - ${CATALOG_ARTIST}` })
  ).toBeVisible();
  await expect(card.locator('.hs-top-result__name')).toHaveText(CATALOG_ARTIST);
  await expect(card.locator('.hs-top-result__meta')).toHaveText(`Artist - ${CATALOG_ARTIST}`);
});
