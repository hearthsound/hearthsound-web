/**
 * The media session the system controls drive.
 *
 * Playing a stored track publishes its metadata and its playback state to the
 * browser's media session, so the operating system's controls show the track
 * and can pause it. The spec reads the session the player published and pauses
 * through the player bar, which the session mirrors.
 */
import { expect, test } from '@playwright/test';

import { signIn, state, waitForLibrary } from './support';

test('playback publishes its metadata and state to the media session', async ({
  page,
  context
}) => {
  await signIn(page);
  await waitForLibrary(context);

  await page.goto(`${state().baseUrl}/library/songs`);
  await page.getByRole('button', { name: 'Test Song 1', exact: true }).click();

  await expect
    .poll(
      () =>
        page.evaluate(() => ({
          title: navigator.mediaSession?.metadata?.title ?? null,
          state: navigator.mediaSession?.playbackState ?? null
        })),
      { timeout: 30_000 }
    )
    .toEqual({ title: 'Test Song 1', state: 'playing' });

  await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.mediaSession?.playbackState ?? null))
    .toBe('paused');
});
