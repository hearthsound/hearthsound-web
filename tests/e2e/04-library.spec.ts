/**
 * The personal library, the server view, feedback and playlists.
 *
 * The scanned folder's tracks show up in every list that draws on the personal
 * library and in the server-wide view. A like, a dislike and a rating survive a
 * reload because the server stores them, and a playlist created as temporary
 * says so, can be kept permanently, and holds the track added to it.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { signIn, state, waitForLibrary } from './support';

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
function songRow(page: Page, title: string) {
  return page
    .locator('li.song-row')
    .filter({ has: page.getByRole('button', { name: title, exact: true }) });
}

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
  await expect(songRow(page, 'Test Song 1').getByText('On server')).toBeVisible();

  await open(page, '/library/albums');
  await expect(page.getByRole('heading', { name: 'Albums' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Test Album' })).toBeVisible();

  await open(page, '/library/artists');
  await expect(page.getByRole('heading', { name: 'Artists' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Test Artist' })).toBeVisible();

  await open(page, '/server/songs');
  await expect(page.getByRole('heading', { name: 'Songs' })).toBeVisible();
  for (const title of ['Test Song 1', 'Test Song 2', 'Test Song 3']) {
    await expect(songRow(page, title)).toBeVisible();
  }

  await open(page, '/library/songs');
  const first = songRow(page, 'Test Song 1');
  await first.getByRole('button', { name: 'Like', exact: true }).click();
  await expect(first.getByRole('button', { name: 'Liked', exact: true })).toBeVisible();
  await first.getByRole('button', { name: '4 of 5' }).click();
  await expect(first.getByRole('button', { name: '4 of 5' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  const second = songRow(page, 'Test Song 2');
  await second.getByRole('button', { name: 'Dislike', exact: true }).click();
  await expect(second.getByRole('button', { name: 'Disliked', exact: true })).toBeVisible();

  await page.reload();
  const reloadedFirst = songRow(page, 'Test Song 1');
  await expect(reloadedFirst.getByRole('button', { name: 'Liked', exact: true })).toBeVisible();
  await expect(reloadedFirst.getByRole('button', { name: '4 of 5' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  await expect(
    songRow(page, 'Test Song 2').getByRole('button', { name: 'Disliked' })
  ).toBeVisible();

  await open(page, '/library/liked');
  await expect(page.getByRole('heading', { name: 'Liked' })).toBeVisible();
  await expect(songRow(page, 'Test Song 1')).toBeVisible();
  await expect(songRow(page, 'Test Song 2')).toHaveCount(0);

  await open(page, '/library/playlists');
  await page.getByRole('button', { name: 'New playlist' }).click();
  const dialog = page.locator('form.dialog');
  await dialog.getByLabel('Name', { exact: true }).fill('Temp list');
  await dialog.getByRole('checkbox', { name: 'Temporary' }).check();
  await dialog.getByRole('button', { name: 'Create', exact: true }).click();

  await expect(page).toHaveURL(/\/playlist\/pl/);
  await expect(page.getByRole('heading', { name: 'Temp list' })).toBeVisible();
  await expect(page.locator('.playlist-badge')).toHaveText(/^Temporary/);
  await page.getByRole('button', { name: 'Keep permanently' }).click();
  await expect(page.locator('.playlist-badge')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Make temporary' })).toBeVisible();

  await open(page, '/library/songs');
  const adding = songRow(page, 'Test Song 1');
  await adding.getByRole('button', { name: 'Add to playlist' }).click();
  await adding.getByRole('button', { name: 'Temp list', exact: true }).click();

  await open(page, '/library/playlists');
  await page.getByRole('link', { name: 'Temp list', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Temp list' })).toBeVisible();
  await expect(page.getByText('1 tracks')).toBeVisible();
  await expect(songRow(page, 'Test Song 1')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('button', { name: 'Make temporary' })).toBeVisible();
  await expect(songRow(page, 'Test Song 1')).toBeVisible();
});
