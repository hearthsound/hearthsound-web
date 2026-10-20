/**
 * The administrator's views.
 *
 * An administrator creates an account with a daily quota, moves a music folder
 * to that account, drags the order of a layer's instances and saves it, cancels
 * and retries an acquisition, reads the storage usage, and finds the settings
 * the configuration file pins read-only while an editable one saves.
 */
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
  const from = list.locator('li.instance').filter({ hasText: name });
  const target = list.locator('li.instance').filter({ hasText: above });
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

test('the admin views manage users, folders, layers, acquisitions and settings', async ({
  page,
  context
}) => {
  await signIn(page);

  await open(page, '/admin/users');
  await page.getByRole('button', { name: 'Create user', exact: true }).click();
  const userDialog = page.getByRole('dialog', { name: 'Create user' });
  await userDialog.getByLabel('Username', { exact: true }).fill(LISTENER_USERNAME);
  await userDialog.getByLabel('Display name', { exact: true }).fill(LISTENER_DISPLAY_NAME);
  await userDialog.getByLabel('Password', { exact: true }).fill(LISTENER_PASSWORD);
  await userDialog.getByLabel('Acquisitions per day').fill('5');
  await userDialog.getByRole('button', { name: 'Create user', exact: true }).click();

  const listenerRow = page.locator('tbody tr', { hasText: LISTENER_USERNAME });
  await expect(listenerRow).toBeVisible();
  await expect(listenerRow.getByText('5 per day')).toBeVisible();

  await open(page, '/admin/folders');
  const folderRow = page.locator('tbody tr', { hasText: state().musicDir });
  await folderRow.getByRole('button', { name: 'Edit', exact: true }).click();
  const folderDialog = page.getByRole('dialog', { name: 'Edit folder' });
  await folderDialog.getByRole('radio', { name: 'An account' }).check();
  await folderDialog.getByRole('combobox').selectOption({ label: LISTENER_USERNAME });
  await folderDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('tbody tr', { hasText: state().musicDir })).toContainText(
    LISTENER_DISPLAY_NAME
  );

  await open(page, '/admin/layers');
  const catalogLayer = page.locator('section.layer', {
    has: page.getByRole('heading', { name: 'catalog', exact: true })
  });
  await expect(
    catalogLayer.getByRole('list', { name: 'Instances of catalog' }).locator('.instance-name')
  ).toHaveText(['Album catalog', 'Hello catalog']);

  await dragInstance(page, 'catalog', 'Hello catalog', 'Album catalog');
  await expect(
    catalogLayer.getByRole('list', { name: 'Instances of catalog' }).locator('.instance-name')
  ).toHaveText(['Hello catalog', 'Album catalog']);
  await catalogLayer.getByRole('button', { name: 'Save', exact: true }).click();
  await expect.poll(() => layerInstances(context, 'catalog')).toEqual(['hellocatalog', 'album']);

  // The queue spec's look-ahead left a failed acquisition for the second track
  // of the catalog album. A stalled download keeps the new attempt alive so it
  // can be cancelled and retried from the ledger.
  const failed = (await ledger(context, 'all')).find((row) => row.trackTitle === 'Fixture Song 2');
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
  await page
    .getByRole('main')
    .getByRole('combobox', { name: 'Show', exact: true })
    .selectOption('recent');
  const failedRow = page.locator('tbody tr', { hasText: 'Fixture Song 2' }).first();
  await expect(failedRow.getByRole('button', { name: 'Retry', exact: true })).toBeVisible();
  await failedRow.getByRole('button', { name: 'Retry', exact: true }).click();

  await page
    .getByRole('main')
    .getByRole('combobox', { name: 'Show', exact: true })
    .selectOption('active');
  const activeRow = page.locator('tbody tr', { hasText: 'Fixture Song 2' });
  await expect(activeRow.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible();
  await activeRow.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('tbody tr', { hasText: 'Fixture Song 2' })).toHaveCount(0);

  await page
    .getByRole('main')
    .getByRole('combobox', { name: 'Show', exact: true })
    .selectOption('recent');
  const cancelledRow = page
    .locator('tbody tr', { hasText: 'Fixture Song 2' })
    .filter({ hasText: 'Cancelled' });
  await expect(cancelledRow).toBeVisible();
  await cancelledRow.getByRole('button', { name: 'Retry', exact: true }).click();

  await page
    .getByRole('main')
    .getByRole('combobox', { name: 'Show', exact: true })
    .selectOption('active');
  await expect(
    page.locator('tbody tr', { hasText: 'Fixture Song 2' }).getByRole('button', { name: 'Cancel' })
  ).toBeVisible();

  await open(page, '/admin/storage');
  await expect(page.getByRole('heading', { name: 'Storage' })).toBeVisible();
  const main = page.getByRole('main');
  for (const card of ['Cache', 'Library', 'Folders']) {
    await expect(main.getByRole('heading', { name: card, exact: true })).toBeVisible();
  }
  await page.getByRole('button', { name: 'Evict now' }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);

  await open(page, '/admin/settings');
  for (const key of [
    'acquisition.poll_interval_ms.interactive',
    'acquisition.poll_interval_ms.background',
    'acquisition.search_poll_interval_ms',
    'acquisition.completion_check_interval_ms'
  ]) {
    const setting = page
      .locator('.setting')
      .filter({ has: page.locator('code.key', { hasText: key }) });
    await expect(setting.getByText('Set in the configuration file')).toBeVisible();
    await expect(setting.locator('input')).toHaveCount(0);
  }

  const lookahead = page.locator('.setting').filter({
    has: page.locator('code.key', { hasText: 'prefetch.lookahead' })
  });
  await expect(lookahead.locator('input')).toHaveValue('3');
  await lookahead.locator('input').fill('4');
  await lookahead.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  const reloaded = page.locator('.setting').filter({
    has: page.locator('code.key', { hasText: 'prefetch.lookahead' })
  });
  await expect(reloaded.locator('input')).toHaveValue('4');
});
