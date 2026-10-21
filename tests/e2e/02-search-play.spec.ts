/**
 * Search and remote playback.
 *
 * The search view lists the scanned track and the catalog result side by side.
 * Song rows carry no availability pills (privacy-scope-2); playing the catalog
 * result runs the acquisition flow, which the player bar reports while it
 * searches, downloads and imports, and playback starts by itself once the file
 * exists. The spec seeds the catalog and acquisition fixtures the same way
 * the server's own integration tests configure them.
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
  enablePlugin,
  HELLO_SLUG,
  progressLabels,
  recordProgressLabels,
  searchSongs,
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
  await enablePlugin(context, ALBUM_CATALOG);
  await enablePlugin(context, ACQUISITION_FIXTURE);
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
  await page.locator('main').getByLabel('Search', { exact: true }).fill('Song');

  const localRow = page.locator('.hs-track-row', { hasText: 'Test Song 1' });
  await expect(localRow).toBeVisible();

  const remoteRow = page.locator('.hs-track-row', { hasText: 'Hello, Song' });
  await expect(remoteRow).toBeVisible();

  const catalog = (await searchSongs(context, 'Song')).find((song) => song.title === 'Hello, Song');
  if (catalog === undefined) {
    throw new Error('the catalog answered no Hello, Song');
  }
  const requestedId = catalog.id;

  await recordProgressLabels(page);
  await remoteRow.getByRole('button', { name: /^Hello, Song/ }).click();

  await expect(page.locator('.player-title')).toHaveText('Hello, Song');
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
