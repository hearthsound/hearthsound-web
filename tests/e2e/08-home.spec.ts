/**
 * Home (l13, p07, p07b, p07c).
 *
 * `/` draws the Home page instead of redirecting to Albums: the "Home" title,
 * the sections that hold something and their full-list links. Customize Home
 * is reached from the account row menu, keeps the 13 sections in one group and
 * stores a switch across a reload. Hiding every section leaves the
 * "Nothing to Show Yet" status page.
 */
import { expect, test } from '@playwright/test';

import { signIn, state, waitForLibrary } from './support';

test('Home stays inside the window with every section and loads placeholders', async ({
  page,
  context
}) => {
  await signIn(page);
  await waitForLibrary(context);

  // Every section on: the page must not grow the document past the window, so
  // the sidebar and the player stay put while only the content scrolls.
  await page.locator('.app-account').click();
  await page.getByRole('menuitem', { name: 'Customize Home', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Customize Home' });
  const switches = dialog.getByRole('switch');
  await expect(switches).toHaveCount(13);
  for (let index = 0; index < 13; index += 1) {
    const control = switches.nth(index);
    if ((await control.getAttribute('aria-checked')) !== 'true') {
      await control.click();
    }
  }
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();

  const size = await page.evaluate(() => {
    const main = document.querySelector('.hs-shell__main');
    return {
      document: document.documentElement.scrollHeight,
      window: window.innerHeight,
      horizontal: main === null ? 0 : main.scrollWidth - main.clientWidth
    };
  });
  expect(size.document).toBe(size.window);
  expect(size.horizontal).toBeLessThanOrEqual(0);

  // A full list shows shimmer cards while its read is in flight instead of the
  // empty state (p07; the failure was the album and playlist lists).
  await page.route('**/rest/getAlbumList2**', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.continue();
  });
  await page.goto(`${state().baseUrl}/home/recently-added`);
  await expect(page.locator('.hs-skeleton').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No Albums Yet' })).toHaveCount(0);
  await expect(page.locator('.hs-card').first()).toBeVisible({ timeout: 15_000 });
});

test('a burst of library changes never blanks loaded shelves', async ({ page, context }) => {
  await signIn(page);
  await waitForLibrary(context);

  const shelves = page.locator('.hs-home-section');
  await expect(shelves.first()).toBeVisible();
  const before = await shelves.count();

  // Every read a refresh makes fails, as it does while the first scan holds
  // the library; the page keeps what it already drew.
  for (const pattern of [
    '**/rest/getAlbumList2**',
    '**/rest/getStarred2**',
    '**/rest/getRandomSongs**'
  ]) {
    await page.route(pattern, (route) => route.abort());
  }

  // A folder scan publishes library.changed, which makes Home refresh.
  const queued = await page.evaluate(async () => {
    const session = await fetch('/api/v1/auth/session', { credentials: 'include' }).then((r) =>
      r.json()
    );
    const headers = {
      'X-Hearthsound-CSRF': session.csrfToken as string,
      'content-type': 'application/json'
    };
    const listed = await fetch('/api/v1/admin/folders', { credentials: 'include', headers }).then(
      (r) => r.json()
    );
    const first = (listed as { folders: { id: string }[] }).folders[0];
    if (first === undefined) {
      return 0;
    }
    const response = await fetch(`/api/v1/admin/folders/${encodeURIComponent(first.id)}/scan`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({ full: false })
    });
    return response.status;
  });
  expect(queued).toBe(202);

  // Wait past the scan's announcement and any refresh it started.
  await page.waitForTimeout(3000);
  await expect(page.getByRole('heading', { name: 'Could Not Load This Page' })).toHaveCount(0);
  await expect(page.locator('.hs-skeleton')).toHaveCount(0);
  await expect(shelves).toHaveCount(before);
});

test('Home draws its shelves and keeps the customisation', async ({ page, context }) => {
  await signIn(page);
  await waitForLibrary(context);

  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(page).toHaveURL(`${state().baseUrl}/`);
  await expect(page.getByRole('button', { name: 'Load more' })).toHaveCount(0);

  // The scanned albums fill Recently Added, and its title opens the full list
  // titled like the shelf (o04, E8).
  const recent = page.getByRole('region', { name: 'Recently Added', exact: true });
  await expect(recent.getByRole('link', { name: /^Test Album/ })).toBeVisible();
  await recent.getByRole('link', { name: 'See all Recently Added' }).click();
  await expect(page).toHaveURL(/\/home\/recently-added$/);
  await expect(page.getByRole('heading', { name: 'Recently Added', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /^Test Album/ })).toBeVisible();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page).toHaveURL(`${state().baseUrl}/`);

  // The account row menu is the entry point (p07b).
  await page.locator('.app-account').click();
  await page.getByRole('menuitem', { name: 'Customize Home', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Customize Home' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('switch')).toHaveCount(13);
  await expect(
    dialog.getByText('Shown when it has something to show', { exact: true })
  ).toHaveCount(4);

  const mostPlayed = dialog.getByRole('switch', { name: 'Most Played', exact: true });
  await expect(mostPlayed).toHaveAttribute('aria-checked', 'false');
  await mostPlayed.click();
  await expect(mostPlayed).toHaveAttribute('aria-checked', 'true');
  await dialog.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(dialog).toHaveCount(0);

  // The choice is stored at once and survives a reload (l13c B, E1).
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await page.locator('.app-account').click();
  await page.getByRole('menuitem', { name: 'Customize Home', exact: true }).click();
  const reopened = page.getByRole('dialog', { name: 'Customize Home' });
  await expect(reopened.getByRole('switch', { name: 'Most Played', exact: true })).toHaveAttribute(
    'aria-checked',
    'true'
  );

  // Every enabled section has been empty since the account started, so hiding
  // the rest leaves the empty page (p07c).
  const switches = reopened.getByRole('switch');
  for (let index = 0; index < (await switches.count()); index += 1) {
    const control = switches.nth(index);
    if ((await control.getAttribute('aria-checked')) === 'true') {
      await control.click();
    }
  }
  await reopened.getByRole('button', { name: 'Done', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nothing to Show Yet' })).toBeVisible();
  await expect(page.getByText('Music you add, play and like fills this page.')).toBeVisible();
});
