/**
 * Playwright configuration for the end-to-end suite.
 *
 * The suite drives the built client in Chromium against a real Hearthsound
 * server: the global setup generates audio, installs the fixture plugins and
 * starts the server, and the global teardown stops it and removes everything it
 * wrote. One worker runs the specs in file order, so the wizard that creates the
 * administrator runs before the views that need one. Autoplay is allowed
 * because the specs assert that playback starts without a further gesture.
 */
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: {
    timeout: 15_000
  },
  reporter: process.env.CI === undefined ? [['list']] : [['github'], ['list']],
  globalSetup: './scripts/e2e-server.mjs',
  globalTeardown: './scripts/e2e-teardown.mjs',
  use: {
    ...devices['Desktop Chrome'],
    launchOptions: {
      args: ['--autoplay-policy=no-user-gesture-required']
    },
    trace: 'retain-on-failure'
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }]
});
