/**
 * Search and remote playback.
 *
 * The search view lists the scanned track and the catalog result side by side,
 * both read from the native search. Song rows carry no availability pills
 * (privacy-scope-2); playing the catalog result runs the acquisition flow,
 * which the player bar reports while it searches, downloads and imports, and
 * playback starts by itself once the file exists - under the one track id the
 * queue already held. The spec seeds the catalog and acquisition fixtures the
 * same way the server's own integration tests configure them.
 */
import { expect, test } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';

import {
  ACQUISITION_FIXTURE,
  ACQUISITION_SLUG,
  ALBUM_CATALOG,
  availabilityOf,
  CATALOG_SLUG,
  createProvider,
  HELLO_SLUG,
  progressLabels,
  recordProgressLabels,
  nativeSearch,
  setLayer,
  signIn,
  state,
  waitForLibrary
} from './support';

/** The audio the acquisition fixture's one candidate offers. */
const CANDIDATE = {
  token: 'cand-1',
  title: 'Hello, Song',
  path: 'Hello Artist/Hello Album/01 - Hello Song.flac',
  files: [
    {
      name: '01 - Hello Song.flac',
      size: 4000,
      format: 'flac',
      bitrateKbps: 900,
      sampleRate: 44100,
      bitDepth: 16,
      durationMs: 180_000,
      trackIndex: 0
    }
  ],
  source: { key: 'peer-1', speedBps: 1_250_000, queueLength: 0, freeSlot: true }
};

/**
 * Puts the catalog and acquisition fixtures in service for the playback specs.
 *
 * The hello catalog fixture becomes the catalog layer's primary, because a
 * layer searches through its first instance; the album catalog the queue spec
 * uses stays behind it for now. The acquisition instance serves the candidate
 * above from the import root the harness filled, at a pace slow enough to
 * read.
 *
 * @param context The browser context.
 * @returns Nothing.
 */
async function seedPlayback(context: BrowserContext): Promise<void> {
  await createProvider(context, {
    slug: CATALOG_SLUG,
    pluginId: ALBUM_CATALOG,
    displayName: 'Album catalog',
    serverConfig: {},
    hostConfig: null
  });
  await createProvider(context, {
    slug: ACQUISITION_SLUG,
    pluginId: ACQUISITION_FIXTURE,
    displayName: 'Acquisition fixture',
    serverConfig: {
      candidates: [CANDIDATE],
      scenario: 'normal',
      searchPolls: 2,
      downloadQueuedPolls: 1,
      downloadRunningPolls: 20,
      downloadBytesPerPoll: 4000,
      outputRoot: 'downloads',
      matchSuffix: '.flac'
    },
    hostConfig: {
      importRoots: [{ id: 'downloads', path: state().downloadsDir, mode: 'move', readOnly: false }],
      maxConcurrent: 2,
      maxConcurrentSearches: 2,
      searchesPerHour: 120
    }
  });
  await setLayer(context, 'catalog', [HELLO_SLUG, CATALOG_SLUG]);
  await setLayer(context, 'acquisition', [ACQUISITION_SLUG]);
}

test('search plays a remote song', async ({ page, context }) => {
  await signIn(page);
  await seedPlayback(context);
  await waitForLibrary(context);

  await page.goto(`${state().baseUrl}/search`);
  // The sidebar field is the one search drives the results page through (l14).
  await page.locator('.app-search').getByLabel('Search', { exact: true }).fill('Song');

  const localRow = page.locator('.hs-track-row', { hasText: 'Test Song 1' });
  await expect(localRow).toBeVisible();

  // One row carries one title, set the first time a provider named the track,
  // so the answer's title is the one the list shows.
  const catalog = (await nativeSearch(context, 'Song', 'tracks')).tracks.find(
    (song) => song.availability === 'remote'
  );
  if (catalog === undefined) {
    throw new Error('the catalog answered no remote track');
  }
  const requestedId = catalog.id;

  const remoteRow = page.locator('.hs-track-row', { hasText: catalog.title });
  await expect(remoteRow).toBeVisible();

  await recordProgressLabels(page);
  await remoteRow.getByRole('button', { name: new RegExp(`^${catalog.title}`) }).click();

  await expect(page.locator('.player-title')).toHaveText(catalog.title);
  await expect
    .poll(async () => (await progressLabels(page)).includes('Searching sources'))
    .toBe(true);
  await expect
    .poll(async () =>
      (await progressLabels(page)).some((label) => /^Downloading \d+%$/.test(label))
    )
    .toBe(true);

  // The acquisition ends by starting the file it imported, without another click.
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible({
    timeout: 45_000
  });
  await expect
    .poll(async () => availabilityOf(context, requestedId), {
      timeout: 30_000
    })
    .toMatch(/^(local|cached)$/);

  const labels = await progressLabels(page);
  expect(labels[0]).toBe('Searching sources');
  expect(labels.findIndex((label) => /^Downloading \d+%$/.test(label))).toBeGreaterThan(0);
});

test('the search field shares its query and Escape returns', async ({ page }) => {
  await signIn(page);
  await page.goto(`${state().baseUrl}/library/albums`);

  const sidebar = page.locator('.app-search').getByLabel('Search', { exact: true });
  await sidebar.fill('Test');

  // Typing in the field writes the address, so the results can be shared.
  await expect(page).toHaveURL(/\/search\?q=Test$/);
  await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
  await expect(page.locator('.hs-top-result')).toBeVisible();
  await expect(sidebar).toHaveValue('Test');

  // The results page's own field on a phone follows the same address, and its
  // typing reaches the sidebar field the same way (l14, p18).
  await page.setViewportSize({ width: 390, height: 844 });
  const field = page.locator('main').getByLabel('Search', { exact: true });
  await expect(field).toHaveValue('Test');
  await field.fill('Test Song');
  await expect(page).toHaveURL(/\/search\?q=Test%20Song$/);
  await expect(sidebar).toHaveValue('Test Song');

  // Escape clears the field and returns to the page the search was opened from.
  await field.press('Escape');
  await expect(page).toHaveURL(/\/library\/albums$/);
  await expect(sidebar).toHaveValue('');

  // The sidebar field follows the same rule, including when it is already the
  // field the results were opened with (b01).
  await page.setViewportSize({ width: 1280, height: 720 });
  await sidebar.fill('Test');
  await expect(page).toHaveURL(/\/search\?q=Test$/);
  await sidebar.press('Escape');
  await expect(page).toHaveURL(/\/library\/albums$/);
  await expect(sidebar).toHaveValue('');
});

test('a field keeps focus and every keystroke while its searches land', async ({ page }) => {
  await signIn(page);
  await page.goto(`${state().baseUrl}/library/albums`);

  // Pauses longer than the 300 ms search delay let each search navigate while
  // the user is still typing; a navigation that resets focus loses the next
  // keystrokes and leaves the field unfocused.
  const typeWithPauses = async (text: string): Promise<void> => {
    for (const key of text) {
      await page.keyboard.type(key);
      await page.waitForTimeout(450);
    }
  };

  const sidebar = page.locator('.app-search').getByLabel('Search', { exact: true });
  await sidebar.click();
  await typeWithPauses('Test Song');
  await expect(page).toHaveURL(/\/search\?q=Test%20Song$/);
  await expect(sidebar).toHaveValue('Test Song');
  await expect(sidebar).toBeFocused();

  // The results page's own field on a phone, typed into from the middle of a
  // query.
  await page.setViewportSize({ width: 390, height: 844 });
  const field = page.locator('main').getByLabel('Search', { exact: true });
  await field.click();
  await page.keyboard.press('End');
  await typeWithPauses(' 1');
  await expect(page).toHaveURL(/\/search\?q=Test%20Song%201$/);
  await expect(field).toHaveValue('Test Song 1');
  await expect(field).toBeFocused();
});
