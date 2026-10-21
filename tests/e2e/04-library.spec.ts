/**
 * The personal library, feedback and playlists.
 *
 * The scanned folder's tracks show up in every list that draws on the personal
 * library. A like, a dislike and a rating survive a reload because the server
 * stores them, and a playlist created from the library holds the track added
 * to it from a song menu.
 *
 * The server-wide view and the song rows' availability pills are gone
 * (privacy-scope-2): the old `/server/*` addresses answer as unknown pages and
 * a song row carries no badge.
 */
import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { pressCentre, signIn, state, waitForLibrary } from './support';

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
 * Returns the row of one track.
 *
 * @param page The page showing the row.
 * @param title The track's title.
 * @returns The row's locator.
 */
function songRow(page: Page, title: string): Locator {
  return page.locator('.hs-track-row').filter({ hasText: title });
}

/**
 * Opens one row's song menu.
 *
 * The row's actions are revealed by hovering it, which is what a pointer user
 * does before pressing "More Actions".
 *
 * @param row The row to open.
 * @returns Nothing.
 */
async function openMenu(row: Locator): Promise<void> {
  await row.hover();
  await row.getByRole('button', { name: 'More Actions' }).click();
}

test('a press anywhere in a song row plays it', async ({ page, context }) => {
  await signIn(page);
  await waitForLibrary(context);
  await open(page, '/library/songs');

  const first = songRow(page, 'Test Song 1');
  const playerTitle = page.locator('.player-bar .hs-player__title');

  // The text and the artwork used to swallow the press; only the gaps between
  // cells played anything.
  await pressCentre(page, first.locator('.hs-track-row__text'));
  await expect(playerTitle).toHaveText('Test Song 1');

  const second = songRow(page, 'Test Song 2');
  await pressCentre(page, second.locator('.hs-track-row__art'));
  await expect(playerTitle).toHaveText('Test Song 2');

  // The actions keep their own press: the menu opens instead of playing.
  await second.hover();
  await second.getByRole('button', { name: 'More Actions' }).click();
  await expect(page.getByRole('menu')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(playerTitle).toHaveText('Test Song 2');
});

test('the library lists the scanned music and keeps opinions and playlists', async ({
  page,
  context
}) => {
  await signIn(page);
  await waitForLibrary(context);

  await open(page, '/library/songs');
  await expect(page.getByRole('heading', { name: 'Songs' })).toBeVisible();
  for (const title of ['Test Song 1', 'Test Song 2', 'Test Song 3']) {
    await expect(songRow(page, title)).toBeVisible();
  }
  const pageHeader = page.locator('.hs-page-header');
  await expect(pageHeader.getByRole('button', { name: 'Play', exact: true })).toBeEnabled();
  await expect(pageHeader.getByRole('button', { name: 'Shuffle', exact: true })).toBeEnabled();
  await expect(songRow(page, 'Test Song 1').getByText('On server')).toHaveCount(0);

  await open(page, '/library/albums');
  await expect(page.getByRole('heading', { name: 'Albums' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Test Album' })).toBeVisible();

  await open(page, '/library/artists');
  await expect(page.getByRole('heading', { name: 'Artists' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Test Artist' })).toBeVisible();

  await open(page, '/server/songs');
  await expect(page.getByText(/Not Found/).first()).toBeVisible();

  await open(page, '/library/nothing');
  await expect(page.getByRole('heading', { name: 'Page Not Found' })).toBeVisible();

  await open(page, '/library/songs');
  const first = songRow(page, 'Test Song 1');
  await openMenu(first);
  let menu = page.getByRole('menu');
  await menu.getByRole('button', { name: 'Like', exact: true }).click();
  await expect(menu.getByRole('button', { name: 'Liked', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await menu.getByRole('radio', { name: '4 of 5' }).click();
  await expect(menu.getByRole('radio', { name: '4 of 5' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');

  const second = songRow(page, 'Test Song 2');
  await openMenu(second);
  menu = page.getByRole('menu');
  await menu.getByRole('button', { name: 'Dislike', exact: true }).click();
  await expect(menu.getByRole('button', { name: 'Disliked', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await page.keyboard.press('Escape');

  await page.reload();
  const reloadedFirst = songRow(page, 'Test Song 1');
  await openMenu(reloadedFirst);
  menu = page.getByRole('menu');
  await expect(menu.getByRole('button', { name: 'Liked', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(menu.getByRole('radio', { name: '4 of 5' })).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape');
  await expect(songRow(page, 'Test Song 1').locator('.hs-feedback-glyph')).toHaveCount(1);

  await openMenu(songRow(page, 'Test Song 2'));
  await expect(
    page.getByRole('menu').getByRole('button', { name: 'Disliked', exact: true })
  ).toBeVisible();
  await page.keyboard.press('Escape');

  await open(page, '/library/liked');
  await expect(page.getByRole('heading', { name: 'Liked' })).toBeVisible();
  await expect(songRow(page, 'Test Song 1')).toBeVisible();
  await expect(songRow(page, 'Test Song 2')).toHaveCount(0);

  await open(page, '/library/playlists');
  await page.getByRole('button', { name: 'New Playlist', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'New Playlist' });
  await dialog.getByLabel('Name', { exact: true }).fill('Temp list');
  await expect(dialog.getByRole('checkbox', { name: 'Temporary' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page).toHaveURL(/\/playlist\/pl/);
  await expect(page.getByRole('heading', { name: 'Temp list' })).toBeVisible();
  await expect(page.locator('.playlist-badge')).toHaveCount(0);

  await open(page, '/library/songs');
  await openMenu(songRow(page, 'Test Song 1'));
  await page.getByRole('menuitem', { name: 'Add to Playlist', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Temp list', exact: true }).click();
  await expect(page.getByText('Added to Temp list.')).toBeVisible();

  await open(page, '/library/playlists');
  await page.getByRole('link', { name: 'Temp list, 1 song', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Temp list' })).toBeVisible();
  await expect(songRow(page, 'Test Song 1')).toBeVisible();

  await page.reload();
  await expect(songRow(page, 'Test Song 1')).toBeVisible();
});
