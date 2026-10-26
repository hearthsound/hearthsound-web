/**
 * The administrator's views, one area per test.
 *
 * An administrator opens the overview, creates an account with a daily quota,
 * moves a music folder to it, drags the order of a layer's instances and
 * watches it save at once, cancels and retries an acquisition, reads the
 * storage usage, finds the settings the configuration file pins read-only
 * while an editable one saves, and deletes the account again. The tests share
 * the signed-in server and run in order, because the account and folder they
 * edit are the ones the later areas show.
 */
import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import {
  ACQUISITION_SLUG,
  layerInstances,
  ledger,
  LISTENER_DISPLAY_NAME,
  LISTENER_PASSWORD,
  LISTENER_USERNAME,
  patchProvider,
  signIn,
  state
} from './support';

/**
 * Opens one admin route.
 *
 * @param page The page to navigate.
 * @param route The route, starting with `/`.
 * @returns Nothing.
 */
async function open(page: Page, route: string): Promise<void> {
  await page.goto(`${state().baseUrl}${route}`);
}

/**
 * Drags one layer instance above another.
 *
 * The layer list moves its entries on pointer input, so the drag is a pressed
 * mouse moved in steps from one entry to the other.
 *
 * @param page The page showing the layer order.
 * @param layer The layer whose list is dragged in.
 * @param name The instance to drag.
 * @param above The instance it is dropped in front of.
 * @returns Nothing.
 */
async function dragInstance(page: Page, layer: string, name: string, above: string): Promise<void> {
  const list = page.getByRole('list', { name: `Instances of ${layer}` });
  const from = list.locator('li.hs-setting-row').filter({ hasText: name });
  const target = list.locator('li.hs-setting-row').filter({ hasText: above });
  const fromBox = await from.boundingBox();
  const targetBox = await target.boundingBox();
  if (fromBox === null || targetBox === null) {
    throw new Error(`the ${layer} layer did not show ${name} and ${above}`);
  }
  const x = fromBox.x + fromBox.width / 2;
  await page.mouse.move(x, fromBox.y + fromBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, targetBox.y + 2, { steps: 25 });
  await page.mouse.move(x, targetBox.y + 2, { steps: 5 });
  await page.mouse.up();
}

test.describe('the admin views', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('the overview opens every area', async ({ page }) => {
    // The administration area opens on the overview; each card opens its area.
    await open(page, '/admin');
    const cards = page.locator('.hs-admin-card');
    await expect(cards).toHaveCount(6);
    await expect(page.getByRole('link', { name: 'Open Users', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Storage', exact: true })).toBeVisible();
  });

  test('an account is created with a quota and switched off and on', async ({ page }) => {
    await open(page, '/admin/users');
    await page.getByRole('button', { name: 'Create User', exact: true }).click();
    const userDialog = page.getByRole('dialog', { name: 'Create User' });

    // Nothing is said until the field is left; then the broken rule is named.
    const username = userDialog.getByLabel('Username', { exact: true });
    const rule = userDialog.getByText(
      'A username holds letters, digits, dots, dashes and underscores only.'
    );
    await username.fill('test user 100000%');
    await expect(rule).toHaveCount(0);
    await username.blur();
    await expect(rule).toBeVisible();

    // A trailing space is a character the rule refuses, not padding.
    await username.fill('listener ');
    await expect(rule).toBeVisible();
    await username.fill(LISTENER_USERNAME);
    await expect(rule).toHaveCount(0);
    await userDialog.getByLabel('Display name', { exact: true }).fill(LISTENER_DISPLAY_NAME);
    const newPassword = userDialog.getByLabel('Password', { exact: true });
    await newPassword.fill(LISTENER_PASSWORD);
    // The client mirrors the server's eight-character rule before it sends.
    const tooShort = userDialog.getByText('A password is at least 8 characters long.');
    await newPassword.fill('short');
    await newPassword.blur();
    await expect(tooShort).toBeVisible();
    await newPassword.fill(LISTENER_PASSWORD);
    await expect(tooShort).toHaveCount(0);
    // The quota is typed, not stepped (k04).
    const acquisitions = userDialog.getByRole('spinbutton', {
      name: 'Acquisitions per day',
      exact: true
    });
    await acquisitions.click();
    await acquisitions.pressSequentially('15');
    await expect(acquisitions).toHaveValue('15');
    await userDialog.getByRole('button', { name: 'Create User', exact: true }).click();

    const listenerRow = page.locator('.hs-setting-row', { hasText: LISTENER_USERNAME });
    await expect(listenerRow).toBeVisible();
    await expect(listenerRow.getByText('15 per day')).toBeVisible();

    await listenerRow.getByRole('button', { name: 'More Actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const editUserDialog = page.getByRole('dialog', { name: 'Edit User' });
    await editUserDialog
      .getByLabel('Display name', { exact: true })
      .fill(`${LISTENER_DISPLAY_NAME} Two`);
    // A typed reset is checked; an empty field keeps the stored password. The
    // field is marked Optional on an edit, which is part of its label.
    const resetPassword = editUserDialog.getByLabel(/^Password/);
    await resetPassword.fill('short');
    await resetPassword.blur();
    await expect(
      editUserDialog.getByText('A password is at least 8 characters long.')
    ).toBeVisible();
    await resetPassword.fill('');
    await expect(editUserDialog.getByText('A password is at least 8 characters long.')).toHaveCount(
      0
    );
    await editUserDialog.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(listenerRow).toContainText(`${LISTENER_DISPLAY_NAME} Two`);

    await listenerRow.getByRole('button', { name: 'More Actions' }).click();
    await page.getByRole('menuitem', { name: 'Disable', exact: true }).click();
    await expect(listenerRow.getByText('Disabled', { exact: true })).toBeVisible();

    await listenerRow.getByRole('button', { name: 'More Actions' }).click();
    await page.getByRole('menuitem', { name: 'Enable', exact: true }).click();
    await expect(listenerRow.getByText('Disabled', { exact: true })).toHaveCount(0);
  });

  test('a folder is reassigned, added, scanned and removed', async ({ page }) => {
    await open(page, '/admin/folders');
    const folderRow = page.locator('.hs-setting-row', { hasText: state().musicDir });
    await folderRow.getByRole('button', { name: 'More Actions' }).click();
    await page.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    const folderDialog = page.getByRole('dialog', { name: 'Edit Folder' });
    await folderDialog.getByRole('radio', { name: 'An account' }).check();
    // The owner is a k05 drop-down: a button opening a listbox.
    await folderDialog.getByRole('button', { name: /^An account/ }).click();
    await folderDialog.getByRole('option', { name: LISTENER_USERNAME }).click();
    await folderDialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(page.locator('.hs-setting-row', { hasText: state().musicDir })).toContainText(
      LISTENER_DISPLAY_NAME
    );

    // A folder of its own, so the Scan command and the status line it drives are
    // exercised without another spec's tracks in the way.
    const extraDir = path.join(state().tmpDir, 'extra-folder');
    mkdirSync(extraDir, { recursive: true });
    await page.getByRole('button', { name: 'Add Folder', exact: true }).click();
    const addFolderDialog = page.getByRole('dialog', { name: 'Add Folder' });
    await addFolderDialog.getByLabel('Path', { exact: true }).fill(extraDir);
    await addFolderDialog.getByLabel('Name', { exact: true }).fill('Zz extra folder');
    await addFolderDialog.getByRole('button', { name: 'Add Folder', exact: true }).click();
    const extraRow = page.locator('.hs-setting-row', { hasText: extraDir });
    await expect(extraRow).toBeVisible();
    // Adding queues a scan of its own, so the line may already hold the result.
    await expect(extraRow.getByRole('status')).toHaveText(/^(Never scanned|Last scan |Scanning: )/);
    await extraRow.getByRole('button', { name: 'More Actions' }).click();
    const queuedScan = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/v1\/admin\/folders\/[^/]+\/scan$/.test(response.url())
    );
    await page.getByRole('menuitem', { name: 'Scan', exact: true }).click();
    expect((await queuedScan).status()).toBe(202);

    // A folder is removed from its row menu, with nothing on disk touched.
    await extraRow.getByRole('button', { name: 'More Actions' }).click();
    await page.getByRole('menuitem', { name: 'Remove Folder', exact: true }).click();
    const removeFolder = page.getByRole('alertdialog', { name: 'Remove Folder?' });
    await removeFolder.getByRole('button', { name: 'Remove Folder', exact: true }).click();
    await expect(extraRow).toHaveCount(0);
  });

  test('a layer order is dragged and saves at once', async ({ page, context }) => {
    await open(page, '/admin/layers');
    const catalogLayer = page.locator('section.layer', {
      has: page.getByRole('heading', { name: 'Catalog', exact: true })
    });
    const catalogRows = catalogLayer
      .getByRole('list', { name: 'Instances of catalog' })
      .locator('li.hs-setting-row');
    await expect(catalogRows.locator('.hs-setting-row__text > span:first-child')).toHaveText([
      'Album catalog',
      'Hello catalog'
    ]);

    await dragInstance(page, 'catalog', 'Hello catalog', 'Album catalog');
    await expect(catalogRows.locator('.hs-setting-row__text > span:first-child')).toHaveText([
      'Hello catalog',
      'Album catalog'
    ]);
    // The layers page saves each change at once and says so (p25b A).
    await expect(page.getByText('Saved the order of Catalog.')).toBeVisible();
    await expect.poll(() => layerInstances(context, 'catalog')).toEqual(['hellocatalog', 'album']);
  });

  test('a failed acquisition is retried and cancelled', async ({ page, context }) => {
    // The queue spec's look-ahead left a failed acquisition for the second track
    // of the catalog album. A stalled download keeps the new attempt alive so it
    // can be cancelled and retried from the ledger.
    const failed = (await ledger(context, 'all')).find(
      (row) => row.trackTitle === 'Fixture Song 2'
    );
    if (failed === undefined) {
      throw new Error('the ledger holds no Fixture Song 2');
    }
    await patchProvider(context, ACQUISITION_SLUG, {
      serverConfig: {
        candidates: [
          {
            token: 'cand-2',
            title: failed.trackTitle,
            path: `Fixture Artist/Fixture Album/02 - ${failed.trackTitle}.flac`,
            files: [
              {
                name: `02 - ${failed.trackTitle}.flac`,
                size: 4000,
                format: 'flac',
                bitrateKbps: 900,
                sampleRate: 44100,
                bitDepth: 16,
                durationMs: 180_000,
                trackIndex: 1
              }
            ],
            source: { key: 'peer-1', speedBps: 1_250_000, queueLength: 0, freeSlot: true }
          }
        ],
        scenario: 'stalled',
        searchPolls: 0,
        downloadQueuedPolls: 0,
        downloadRunningPolls: 20,
        downloadBytesPerPoll: 4000,
        outputRoot: 'downloads',
        matchSuffix: '.flac'
      }
    });

    await open(page, '/admin/acquisitions');
    const activeList = page.getByRole('list', { name: 'Active acquisitions' });
    const recentList = page.getByRole('list', { name: 'Recent acquisitions' });

    // The failed row sits under Recent; Retry starts a new attempt, which moves
    // it to Active.
    const failedRow = recentList.locator('.hs-setting-row', { hasText: 'Fixture Song 2' }).first();
    await expect(failedRow.getByRole('button', { name: 'More Actions' })).toBeVisible();
    await failedRow.getByRole('button', { name: 'More Actions' }).click();
    await page.getByRole('menuitem', { name: 'Retry', exact: true }).click();

    const retriedRow = activeList.locator('.hs-setting-row', { hasText: 'Fixture Song 2' });
    await expect(retriedRow.getByRole('button', { name: 'More Actions' })).toBeVisible();
    await retriedRow.getByRole('button', { name: 'More Actions' }).click();
    await page.getByRole('menuitem', { name: 'Cancel', exact: true }).click();
    await expect(activeList.locator('.hs-setting-row', { hasText: 'Fixture Song 2' })).toHaveCount(
      0
    );

    // Cancelling moves the row back to Recent, where it can be retried again.
    const cancelledRow = recentList
      .locator('.hs-setting-row', { hasText: 'Fixture Song 2' })
      .filter({ hasText: 'Cancelled' });
    await expect(cancelledRow).toBeVisible();
    await cancelledRow.getByRole('button', { name: 'More Actions' }).click();
    await page.getByRole('menuitem', { name: 'Retry', exact: true }).click();

    await expect(
      activeList
        .locator('.hs-setting-row', { hasText: 'Fixture Song 2' })
        .getByRole('button', { name: 'More Actions' })
    ).toBeVisible();
  });

  test('the storage usage and maintenance pass', async ({ page }) => {
    await open(page, '/admin/storage');
    await expect(page.getByRole('heading', { name: 'Storage' })).toBeVisible();
    const main = page.getByRole('main');
    for (const label of ['Library', 'Downloads', 'Cache', 'Free']) {
      await expect(main.locator('.hs-storage-legend__item', { hasText: label })).toBeVisible();
    }
    await expect(main.getByText(/^Pinned tracks: \d+$/)).toBeVisible();
    await expect(page.locator('[data-setting="storage.cache.max_bytes"]')).toContainText(
      'Cache size limit'
    );
    await page.getByRole('button', { name: 'Evict Now', exact: true }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('the settings save, reset and stay pinned', async ({ page }) => {
    await open(page, '/admin/settings');

    // Settings that accept a fixed set are drop-downs of those values, and the
    // default permissions are one checkbox per permission.
    await expect(
      page.locator('[data-setting="storage.cache.eviction"] [aria-haspopup="listbox"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-setting="storage.unpin_action"] [aria-haspopup="listbox"]')
    ).toBeVisible();
    await expect(
      page.locator('[data-setting="users.default_permissions"] input[type="checkbox"]')
    ).toHaveCount(3);

    for (const key of [
      'acquisition.poll_interval_ms.interactive',
      'acquisition.poll_interval_ms.background',
      'acquisition.search_poll_interval_ms',
      'acquisition.completion_check_interval_ms'
    ]) {
      const setting = page.locator(`[data-setting="${key}"]`);
      await expect(setting.getByText('Set in the configuration file')).toBeVisible();
      await expect(setting.locator('input')).toHaveCount(0);
    }

    const lookahead = page.locator('[data-setting="prefetch.lookahead"]');
    await expect(lookahead).toContainText('Songs to prefetch');
    const lookaheadField = lookahead.getByRole('spinbutton', { name: 'Songs to prefetch' });
    await expect(lookaheadField).toHaveValue('3');
    await lookaheadField.fill('4');
    await lookahead.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(lookahead.getByRole('button', { name: 'Save', exact: true })).toHaveCount(0);
    await page.reload();
    const reloaded = page.locator('[data-setting="prefetch.lookahead"]');
    await expect(reloaded.getByRole('spinbutton')).toHaveValue('4');

    // Use Default removes the stored value, so the built-in default applies.
    await reloaded.getByRole('button', { name: 'More Actions' }).click();
    await page.getByRole('menuitem', { name: 'Use Default', exact: true }).click();
    await page.reload();
    await expect(
      page.locator('[data-setting="prefetch.lookahead"]').getByRole('spinbutton')
    ).toHaveValue('3');

    // A switch saves the moment it flips, without a Save button.
    const autoUpdate = page.locator('[data-setting="plugins.auto_update"]');
    const autoSwitch = autoUpdate.getByRole('switch');
    const autoBefore = await autoSwitch.getAttribute('aria-checked');
    await autoSwitch.click();
    const autoAfter = autoBefore === 'true' ? 'false' : 'true';
    await expect(autoSwitch).toHaveAttribute('aria-checked', autoAfter);
    await expect(autoSwitch).toBeEnabled();
    await page.reload();
    const reloadedSwitch = page.locator('[data-setting="plugins.auto_update"]').getByRole('switch');
    await expect(reloadedSwitch).toHaveAttribute('aria-checked', autoAfter);
    await reloadedSwitch.click();
    await expect(reloadedSwitch).toHaveAttribute('aria-checked', autoBefore ?? 'false');
  });

  test('the account is deleted from its row menu', async ({ page }) => {
    // The account created at the start is deleted from its row menu.
    await open(page, '/admin/users');
    const removable = page.locator('.hs-setting-row', { hasText: LISTENER_USERNAME });
    await removable.getByRole('button', { name: 'More Actions' }).click();
    await page.getByRole('menuitem', { name: 'Delete User', exact: true }).click();
    const removeUser = page.getByRole('alertdialog', { name: 'Delete User?' });
    await removeUser.getByRole('button', { name: 'Delete User', exact: true }).click();
    await expect(removable).toHaveCount(0);
  });
});
