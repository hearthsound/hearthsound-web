/**
 * Uploading a file with its progress.
 *
 * The Uploads page sends one request per file, so the browser reports how much
 * of the body it has sent and the page shows that in the file's state pill.
 * Throttling the tab's upload makes the progress visible on a loopback server;
 * once the request answers, the file says it is done and the uploaded song
 * joins the list below the drop panel.
 */
import { expect, test } from '@playwright/test';
import path from 'node:path';

import { signIn, state } from './support';

test('an uploaded file reports its progress and joins the uploads view', async ({
  page,
  context
}) => {
  await signIn(page);
  await page.goto(`${state().baseUrl}/library/uploads`);
  await expect(page.getByRole('heading', { name: 'Uploads' })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Drop audio files' })).toBeVisible();

  await page.evaluate(() => {
    const seen: string[] = [];
    window.__e2eUploadLabels = seen;
    const read = (): void => {
      for (const node of document.querySelectorAll('.hs-upload-row .hs-pill')) {
        const text = node.textContent?.trim() ?? '';
        if (text !== '' && seen[seen.length - 1] !== text) {
          seen.push(text);
        }
      }
    };
    read();
    new MutationObserver(read).observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true
    });
  });

  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 0,
    downloadThroughput: -1,
    uploadThroughput: 40_000,
    connectionType: 'cellular3g'
  });

  await page
    .locator('input[type="file"]')
    .setInputFiles(path.join(state().tmpDir, 'upload', 'Uploaded Song.flac'));

  await expect
    .poll(async () => (await page.evaluate(() => window.__e2eUploadLabels ?? [])).length)
    .toBeGreaterThan(1);
  const labels = await page.evaluate(() => window.__e2eUploadLabels ?? []);
  expect(labels.some((label) => /^Uploading \d+%$/.test(label))).toBe(true);

  await expect(page.locator('.hs-upload-row .hs-pill')).toHaveText('Done', { timeout: 60_000 });

  const uploaded = page.locator('.hs-track-row', { hasText: 'Uploaded Song' });
  await expect(uploaded).toBeVisible();
  await expect(uploaded.getByText('Upload Artist')).toBeVisible();
});
