/**
 * The first-run wizard against a fresh server.
 *
 * The server the harness started has no administrator: the wizard creates one
 * from the printed setup link, adds the music folder it is scanned from, puts
 * the fixture plugins of the catalog and metadata layers in service with their
 * instances, orders the layers, and reports what answers. Every later spec
 * signs in as the account this one creates.
 */
import { expect, test } from '@playwright/test';

import { ADMIN_DISPLAY_NAME, ADMIN_PASSWORD, ADMIN_USERNAME, state } from './support';

test('the wizard creates an administrator and a working server', async ({ page }) => {
  await page.goto(state().setupUrl);

  await expect(page.getByRole('heading', { name: 'Set up Hearthsound' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Administrator' })).toBeVisible();

  await page.getByLabel('Username', { exact: true }).fill(ADMIN_USERNAME);
  await page.getByLabel('Display name', { exact: true }).fill(ADMIN_DISPLAY_NAME);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByLabel('Repeat the password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Create the administrator' }).click();

  await expect(page.getByRole('heading', { name: 'Music folders' })).toBeVisible();
  await page.getByRole('button', { name: 'Add folder', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Add folder' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel(/^Path/).fill(state().musicDir);
  await dialog.getByLabel(/^Name/).fill('Test library');

  // The association defaults to the administrator the previous step created.
  await expect(dialog.getByRole('radio', { name: 'An account' })).toBeChecked();
  await expect(dialog.locator('option:checked')).toHaveText(ADMIN_USERNAME);
  await dialog.getByRole('button', { name: 'Add folder', exact: true }).click();

  const folderRow = page.locator('tbody tr', { hasText: state().musicDir });
  await expect(folderRow).toBeVisible();
  await expect(folderRow.getByText(ADMIN_DISPLAY_NAME)).toBeVisible();

  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Plugins' })).toBeVisible();
  await page.getByRole('checkbox', { name: 'Hello catalog' }).check();
  await page.getByRole('checkbox', { name: 'Metadata fixture' }).check();
  await page.getByRole('button', { name: 'Install and continue' }).click();

  await expect(page.getByRole('heading', { name: 'Configure' })).toBeVisible();

  const hello = page.locator('section.instance', { hasText: 'Hello catalog' });
  await hello.getByRole('button', { name: 'Add instance' }).click();
  await expect(hello.getByText('in service as hellocatalog')).toBeVisible();

  const metadata = page.locator('section.instance', { hasText: 'Metadata fixture' });
  await metadata.getByRole('button', { name: 'Add instance' }).click();
  await expect(metadata.getByText('in service as metadatafixture')).toBeVisible();

  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Order' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'catalog' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'metadata' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Check' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Ready - hello-catalog ready/ })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Ready - metadata-fixture ready/ })).toBeVisible();
  await expect(
    page.getByRole('row', { name: /The server itself/ }).getByText(/Ready - /)
  ).toBeVisible();

  // The folder scan the wizard queued finishes and is reported in place.
  const folderStatus = page.locator('.folders').getByRole('status');
  await expect(folderStatus).toBeVisible();
  await expect(folderStatus).not.toHaveText('Waiting for its first scan', { timeout: 30_000 });

  await page.getByRole('button', { name: 'Finish', exact: true }).click();
  await expect(page).toHaveURL(/\/library\/albums$/);
});
