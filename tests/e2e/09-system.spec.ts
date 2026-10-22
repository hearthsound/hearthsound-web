/**
 * System states (p27).
 *
 * An address no route answers draws the k22 Page Not Found page inside the
 * shell. A request that never reaches the server raises the floating k21
 * unreachable banner, whose Retry probes the server and clears it once it
 * answers. A session the server rejects raises the warning banner above the
 * sign-in title, and signing in again clears it.
 *
 * The suite runs in file order: the administrator and the listener exist from
 * the earlier specs.
 */
import { expect, test } from '@playwright/test';

import { ADMIN_PASSWORD, ADMIN_USERNAME, api, signIn, state } from './support';

test('an unknown route shows the not-found page inside the shell', async ({ page }) => {
  await signIn(page);

  await page.goto(`${state().baseUrl}/no-such-page`);

  await expect(page).toHaveTitle('Page Not Found - Hearthsound');
  const status = page.locator('.hs-status-page');
  await expect(status.getByRole('heading', { name: 'Page Not Found', exact: true })).toBeVisible();
  await expect(status).toContainText('This address does not match any page.');
  // The route error keeps the app around it: sidebar and player stay.
  await expect(page.locator('.hs-shell__sidebar')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Player' })).toBeVisible();

  await status.getByRole('button', { name: 'Go Home', exact: true }).click();
  await expect(page).toHaveURL(`${state().baseUrl}/`);
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
});

test('a failed request floats the unreachable banner over the page until Retry succeeds', async ({
  page
}) => {
  await signIn(page);

  // Nothing reaches the server from here on; the client keeps the page it has.
  await page.route('**/api/**', (route) => route.abort());
  await page.route('**/rest/**', (route) => route.abort());

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Albums', exact: true })
    .click();
  await expect(page).toHaveURL(`${state().baseUrl}/library/albums`);

  const banner = page.locator('.hs-banner--error');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute('role', 'alert');
  await expect(banner).toContainText('Server unreachable. Trying again...');
  // The page underneath stays: the shell and the Albums header are still there.
  await expect(page.locator('.hs-shell__sidebar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Albums', exact: true })).toBeVisible();

  // With the server answering again, the banner's own Retry clears it.
  await page.unroute('**/api/**');
  await page.unroute('**/rest/**');
  await banner.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(banner).toHaveCount(0);
});

test('a dropped session explains itself on sign-in and signing in again works', async ({
  page,
  context
}) => {
  await signIn(page);

  // The server ends the session while the client still believes it is signed
  // in; the next read answers 401, the status a rejected session is answered
  // with.
  await api(context, 'POST', '/api/v1/auth/logout');
  await page.route('**/rest/**', (route) =>
    route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({
        'subsonic-response': { status: 'failed', error: { code: 40 } }
      })
    })
  );

  await page
    .getByRole('navigation', { name: 'Main' })
    .getByRole('link', { name: 'Songs', exact: true })
    .click();

  await expect(page).toHaveURL(`${state().baseUrl}/login`);
  const banner = page.locator('.hs-banner--warning');
  await expect(banner).toBeVisible();
  await expect(banner).toHaveAttribute('role', 'alert');
  await expect(banner).toContainText('Your session ended. Sign in again to continue.');

  await page.unroute('**/rest/**');
  await page.locator('input[name="username"]').fill(ADMIN_USERNAME);
  await page.locator('input[name="password"]').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();

  await expect(page).toHaveURL(`${state().baseUrl}/`);
  await expect(page.getByRole('heading', { name: 'Home', exact: true })).toBeVisible();
  await expect(banner).toHaveCount(0);
});
