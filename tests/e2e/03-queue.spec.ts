/**
 * The now-playing overlay and its queue prefetch states.
 *
 * Playing an album declares the whole album as the queue, and the server looks
 * ahead at the next items of it. The overlay shows what the scheduler decided
 * for each upcoming row, so the next three items report that their acquisition
 * is queued or running while the item beyond the look-ahead says nothing is
 * being prefetched. The first track is acquired before the album is opened, so
 * playback starts at once, and the acquisition instance is slowed down
 * afterwards so the look-ahead stays visible instead of finishing within a
 * poll.
 *
 * The queue is not a route: the sidebar row and the player's surfaces open the
 * overlay, an empty queue keeps it shut, and Escape and the chevron close it.
 * With no lyrics source yet, the Lyrics | Queue switch is absent and the right
 * column is the queue, whose rows start on the panel's own edge.
 *
 * The player also remembers what it was playing: a reload brings the same song
 * back, paused, and loads no stream until the user presses play.
 */
import { expect, test } from '@playwright/test';
import type { BrowserContext } from '@playwright/test';

import {
  ACQUISITION_SLUG,
  availabilityOf,
  catalogAlbum,
  openNowPlaying,
  patchProvider,
  pressCentre,
  placeDownloadAudio,
  restPost,
  setLayer,
  signIn,
  sleep,
  state,
  waitForLibrary
} from './support';

declare global {
  interface Window {
    /** The media elements the reloaded page created, so their state can be read. */
    __e2eAudios?: HTMLAudioElement[];
  }
}

/** The candidate that matches the first track of the catalog album. */
const CANDIDATE = {
  token: 'cand-1',
  title: 'Fixture Song 1',
  path: 'Fixture Artist/Fixture Album/01 - Fixture Song 1.flac',
  files: [
    {
      name: '01 - Fixture Song 1.flac',
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
 * Configures the acquisition instance for one pace.
 *
 * @param context The browser context.
 * @param searchPolls How many polls its searches report running before they
 *   complete.
 * @returns Nothing.
 */
async function configureAcquisition(context: BrowserContext, searchPolls: number): Promise<void> {
  await patchProvider(context, ACQUISITION_SLUG, {
    serverConfig: {
      candidates: [CANDIDATE],
      scenario: 'normal',
      searchPolls,
      downloadQueuedPolls: 0,
      downloadRunningPolls: 20,
      downloadBytesPerPoll: 4000,
      outputRoot: 'downloads',
      matchSuffix: '.flac'
    }
  });
}

test('the panel hands its right column to the queue', async ({ page, context }) => {
  await signIn(page);
  await waitForLibrary(context);

  await page.goto(`${state().baseUrl}/library/songs`);
  await page.locator('.hs-track-row').first().locator('.hs-track-row__lead').click({ force: true });
  await openNowPlaying(page);

  const view = page.locator('.hs-now-playing');

  // No lyrics source exists yet, so the Lyrics | Queue switch is absent and the
  // queue is what the right column shows (p19 C, p19-r1).
  await expect(view.locator('.hs-now-playing__switch')).toHaveCount(0);
  await expect(view.locator('.hs-now-playing__panel .hs-track-list')).toBeVisible();

  // The queue's artwork starts on the panel's own edge, so the rows line up
  // with the column they sit in.
  const edges = await page.evaluate(() => {
    const left = (selector: string): number => {
      const box = document.querySelector(selector)?.getBoundingClientRect();
      return box === undefined ? Number.NaN : box.left;
    };
    return {
      art: left('.hs-track-row--queue .hs-track-row__lead'),
      panel: left('.hs-now-playing__panel')
    };
  });
  expect(Math.abs(edges.art - edges.panel)).toBeLessThanOrEqual(1);
});

test('the queue reports what is prefetched for each upcoming item', async ({ page, context }) => {
  await signIn(page);
  await waitForLibrary(context);

  // An empty queue has nothing to show, so the sidebar row does not open the
  // view and the browser stays on the page (p19-r1 audit).
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Queue' }).click();
  await expect(page.locator('.hs-now-playing')).toHaveCount(0);
  await expect(page).toHaveURL(`${state().baseUrl}/`);

  await setLayer(context, 'catalog', ['album', 'hellocatalog']);
  await setLayer(context, 'acquisition', [ACQUISITION_SLUG]);

  const album = await catalogAlbum(context, 'Fixture Album');
  const first = album.tracks.find((track) => track.title === 'Fixture Song 1');
  if (first === undefined) {
    throw new Error('the catalog album holds no Fixture Song 1');
  }

  // The album is opened after its first track exists, so playing it starts
  // playback and declares the queue the scheduler looks ahead from.
  placeDownloadAudio('01 - Fixture Song 1.flac');
  await configureAcquisition(context, 2);
  await restPost(context, 'hsAcquire', { id: first.id, priority: 'play' });
  await expect
    .poll(() => availabilityOf(context, first.id), { timeout: 60_000 })
    .toMatch(/^(local|cached)$/);

  // A search that stays running keeps every prefetch acquisition active for as
  // long as the queue is looked at.
  await configureAcquisition(context, 6000);

  await page.goto(`${state().baseUrl}/album/${album.id}`);
  await expect(page.getByRole('heading', { name: 'Fixture Album' })).toBeVisible();
  await page.getByRole('button', { name: /^Fixture Song 1/ }).click();

  // The queue lives in memory, so it is reached through the sidebar rather than
  // by loading the page again.
  await openNowPlaying(page);

  const view = page.locator('.hs-now-playing');
  const items = view.locator('.hs-track-row--queue');
  await expect(items).toHaveCount(5);
  await expect(items.nth(0)).toHaveClass(/hs-track-row--current/);

  // Only the upcoming rows carry a prefetch pill; the playing row does not.
  await expect(items.nth(0).locator('.hs-pill')).toHaveCount(0);
  for (const index of [1, 2, 3]) {
    await expect(items.nth(index).locator('.hs-pill')).toHaveText(/Prefetch(ing| queued)/);
  }
  await expect(items.nth(4).locator('.hs-pill')).toHaveText(/Not prefetched/);

  // A press anywhere in a queue row plays that row: the text and the artwork
  // of the played row, and the text of an upcoming one.
  await pressCentre(page, items.nth(1).locator('.hs-track-row__text'));
  await expect(items.nth(1)).toHaveClass(/hs-track-row--current/);
  await expect(items.nth(0)).toHaveClass(/hs-track-row--played/);
  await expect(page.locator('.player-bar .hs-player__title')).toHaveText('Fixture Song 2');

  await pressCentre(page, items.nth(0).locator('.hs-track-row__art'));
  await expect(items.nth(0)).toHaveClass(/hs-track-row--current/);
  await expect(page.locator('.player-bar .hs-player__title')).toHaveText('Fixture Song 1');

  // Escape closes the view and returns to the page underneath.
  await page.keyboard.press('Escape');
  await expect(view).toHaveCount(0);

  // The player bar's song region opens it too, and the chevron closes it.
  await page.locator('.player-bar .hs-player__now-playing').click();
  await expect(view).toBeVisible();
  await view.getByRole('button', { name: 'Close' }).click();
  await expect(view).toHaveCount(0);

  // So does the player's queue toggle.
  await page
    .locator('.player-bar .hs-player__end')
    .getByRole('button', { name: 'Show Queue' })
    .click();
  await expect(view).toBeVisible();
});

test('a reload brings the played song back, paused', async ({ page, context }) => {
  await signIn(page);
  await waitForLibrary(context);

  await page.goto(`${state().baseUrl}/library/songs`);
  await page.getByRole('button', { name: /^Test Song 1/ }).click();
  await expect(page.locator('.player-bar .hs-player__title')).toHaveText('Test Song 1');
  const player = page.getByRole('region', { name: 'Player' });
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await sleep(2000);

  // Every media element the reloaded page creates, so its pause state can be
  // read: the player's element is not in the document.
  await page.addInitScript(() => {
    const NativeAudio = window.Audio;
    const elements: HTMLAudioElement[] = [];
    window.__e2eAudios = elements;
    window.Audio = function (...args: ConstructorParameters<typeof Audio>) {
      const element = new NativeAudio(...args);
      elements.push(element);
      return element;
    } as unknown as typeof Audio;
  });

  // From the reload on, no stream may be read before the user presses play.
  const streams: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/rest/stream') {
      streams.push(request.url());
    }
  });

  await page.reload();

  // The same track is shown and the transport offers to play it, not to pause
  // it: the restored playback is paused.
  await expect(page.locator('.player-bar .hs-player__title')).toHaveText('Test Song 1');
  await expect(player.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        paused: (window.__e2eAudios ?? []).every((element) => element.paused),
        session: navigator.mediaSession?.playbackState ?? null
      }))
    )
    .toEqual({ paused: true, session: 'paused' });

  // No stream was loaded just by restoring.
  await sleep(1000);
  expect(streams).toEqual([]);

  await player.getByRole('button', { name: 'Play', exact: true }).click();

  await expect(player.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await expect.poll(() => streams.length).toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => (window.__e2eAudios ?? []).some((element) => !element.paused)))
    .toBe(true);
});
