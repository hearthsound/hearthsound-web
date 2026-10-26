/**
 * Unified artist and album pages.
 *
 * An artist page is the artist's whole discography whichever id opened it: the
 * catalog's albums with the library's own in their places, marked when the
 * library holds them. An album page is the whole tracklist the same way, with
 * the songs the library holds marked. The spec saves one catalog song, so the
 * artist and its album are in the personal library, and then reaches the pages
 * from the library's artist list and from a search result.
 */
import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

import {
  api,
  createProvider,
  ENRICHMENT_WINDOW_MS,
  layerInstances,
  openNowPlaying,
  restGet,
  restPost,
  setLayer,
  signIn,
  sleep,
  state
} from './support';

/** The plugin id of the discography catalog fixture. */
const DISCOGRAPHY_CATALOG = 'com.example.discography-catalog';

/** The instance slug the spec gives the discography fixture. */
const DISCOGRAPHY_SLUG = 'disco';

/** The artist the discography fixture holds. */
const DISCOGRAPHY_ARTIST = 'Discography Artist';

/** The remastered album the saved song belongs to. */
const SECOND_WIND = 'Second Wind (Remastered 2009)';

/** The song the spec saves; the other two tracks stay in the catalog. */
const SAVED_SONG = 'Breeze';

/** The catalog layer as the spec found it, so it can be put back. */
let previousLayer: string[] = [];

/** Whether the fixture is already in service for this run. */
let seeded = false;

/**
 * Puts the discography fixture in service and saves one of its songs.
 *
 * The instance goes first in the catalog layer, so every page the spec opens
 * reads its albums from it. The saved song is what puts the artist and its
 * album in the personal library, which is what the pages then mark.
 *
 * @param context The browser context, signed in as the administrator.
 * @returns Nothing.
 */
async function seedDiscography(context: BrowserContext): Promise<void> {
  if (seeded) {
    return;
  }
  seeded = true;
  const listed = (await (await api(context, 'GET', '/api/v1/admin/providers')).json()) as {
    providers?: { slug: string }[];
  };
  if (!(listed.providers ?? []).some((provider) => provider.slug === DISCOGRAPHY_SLUG)) {
    await createProvider(context, {
      slug: DISCOGRAPHY_SLUG,
      pluginId: DISCOGRAPHY_CATALOG,
      displayName: 'Discography catalog',
      serverConfig: {},
      hostConfig: null
    });
  }
  const current = await layerInstances(context, 'catalog');
  previousLayer = current.filter((slug) => slug !== DISCOGRAPHY_SLUG);
  await setLayer(context, 'catalog', [DISCOGRAPHY_SLUG, ...previousLayer]);

  // The instance becomes the layer's primary when the registry the write woke
  // has rebuilt, so the search is repeated until it answers from it.
  for (let attempt = 0; attempt < 20; attempt++) {
    const found = await restGet(context, 'search3', { query: SAVED_SONG });
    const results = found.searchResult3 as { song?: { id: string; title: string }[] } | undefined;
    const song = (results?.song ?? []).find((entry) => entry.title === SAVED_SONG);
    if (song !== undefined) {
      await restPost(context, 'hsSave', { id: song.id });
      return;
    }
    if (attempt === 19) {
      throw new Error(`no ${SAVED_SONG} in the catalog answer: ${JSON.stringify(found)}`);
    }
    await sleep(500);
  }
}

/**
 * Opens one route of the client.
 *
 * @param page The page to navigate.
 * @param route The route, starting with `/`.
 * @returns Nothing.
 */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(`${state().baseUrl}${route}`);
}

/**
 * Returns the marks a container shows for library membership.
 *
 * @param page The page to read.
 * @param container The selector of the list or grid that holds the items.
 * @returns The locator of the marks.
 */
function libraryMarks(page: Page, container: string) {
  return page.locator(container).getByRole('img', { name: 'In your library' });
}

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  await seedDiscography(context);
  await context.close();
});

test.afterAll(async ({ browser }) => {
  if (previousLayer.length === 0) {
    return;
  }
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);
  await setLayer(context, 'catalog', previousLayer);
  await context.close();
});

test('an artist page lists the whole discography and marks the library album', async ({
  page,
  context
}) => {
  await signIn(page);
  await seedDiscography(context);

  await open(page, '/library/artists');
  await page.getByRole('link', { name: DISCOGRAPHY_ARTIST }).click();

  // A cold catalog page draws the hero and the album the library holds at once,
  // and never claims the artist has nothing while the enrichment job runs.
  await expect(page.getByRole('heading', { name: DISCOGRAPHY_ARTIST })).toBeVisible();
  const grid = page.locator('.album-grid');
  await expect(grid.getByRole('link', { name: SECOND_WIND })).toBeVisible();
  await expect(page.getByText('Nothing by this artist yet.')).toHaveCount(0);

  // The discography the catalog knows arrives in place once the job announces
  // it: the address and the page do not move, and nothing is re-read from the
  // route.
  const address = page.url();
  await expect(grid.locator('.hs-card--album')).toHaveCount(3, {
    timeout: ENRICHMENT_WINDOW_MS
  });
  expect(page.url()).toBe(address);
  await expect(libraryMarks(page, '.album-grid')).toHaveCount(1);
  await expect(
    page.locator('.album-grid .hs-card').filter({ hasText: SECOND_WIND }).getByRole('img')
  ).toHaveAttribute('aria-label', 'In your library');
});

test('an album page lists the whole tracklist and marks the library song', async ({
  page,
  context
}) => {
  await signIn(page);
  await seedDiscography(context);

  await open(page, '/library/artists');
  await page.getByRole('link', { name: DISCOGRAPHY_ARTIST }).click();
  await page.locator('.album-grid').getByRole('link', { name: SECOND_WIND }).click();

  await expect(page.getByRole('heading', { name: SECOND_WIND })).toBeVisible();
  const rows = page.locator('.hs-track-list');
  await expect(rows.locator('.hs-track-row')).toHaveCount(3);
  await expect(rows.getByText('Gust (Remastered 2009)')).toBeVisible();
  await expect(rows.getByText(SAVED_SONG)).toBeVisible();
  await expect(rows.getByText('Gale', { exact: true })).toBeVisible();
  await expect(libraryMarks(page, '.hs-track-list')).toHaveCount(1);
  await expect(
    page.locator('.hs-track-row').filter({ hasText: SAVED_SONG }).getByRole('img')
  ).toHaveAttribute('aria-label', 'In your library');
});

test('a search result opens the same artist page', async ({ page, context }) => {
  await signIn(page);
  await seedDiscography(context);

  await open(page, '/search');
  await page.locator('.app-search').getByLabel('Search', { exact: true }).fill(DISCOGRAPHY_ARTIST);
  const top = page.locator('.hs-top-result');
  await expect(top.locator('.hs-top-result__name')).toHaveText(DISCOGRAPHY_ARTIST);
  await top.getByRole('link').first().click();

  await expect(page.getByRole('heading', { name: DISCOGRAPHY_ARTIST })).toBeVisible();
  await expect(page).toHaveURL(/\/artist\/discography-artist$/);
  const grid = page.locator('.album-grid');
  await expect(grid.locator('.hs-card--album')).toHaveCount(3);
  await expect(libraryMarks(page, '.album-grid')).toHaveCount(1);
});

test('a readable artist path opens the page and a top song plays', async ({ page, context }) => {
  await signIn(page);
  await seedDiscography(context);

  await open(page, '/artist/discography-artist');
  await expect(page.getByRole('heading', { name: DISCOGRAPHY_ARTIST })).toBeVisible();
  await expect(page).toHaveURL(/\/artist\/discography-artist$/);

  const row = page.locator('.top-list .hs-track-row').first();
  const title = await row.locator('.hs-track-row__title').textContent();
  await row.locator('.hs-track-row__open').click();

  await openNowPlaying(page);
  await expect(page.locator('.hs-now-playing__title')).toHaveText(title ?? '');
});

test('an album card opens its readable path', async ({ page, context }) => {
  await signIn(page);
  await seedDiscography(context);

  await open(page, '/library/artists');
  await page.getByRole('link', { name: DISCOGRAPHY_ARTIST }).click();
  await page.locator('.album-grid').getByRole('link', { name: SECOND_WIND }).click();

  await expect(page).toHaveURL(/\/album\/discography-artist\/second-wind-remastered-2009$/);
  await expect(page.getByRole('heading', { name: SECOND_WIND })).toBeVisible();
});
