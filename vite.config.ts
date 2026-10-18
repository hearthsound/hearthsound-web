/**
 * Vite configuration: the SvelteKit plugin with the application's build options,
 * the development proxy that forwards API and media requests to a locally running
 * Hearthsound server, and the Vitest configuration for unit tests.
 *
 * SvelteKit 3 reads its configuration from this file rather than from a
 * `svelte.config.js`; the options below are the client's static adapter and
 * root-relative path settings.
 */
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

/**
 * Origin of the Hearthsound server used while developing. Override it with the
 * `HEARTHSOUND_DEV_SERVER` environment variable when the server does not listen
 * on the default port.
 */
const devServer = process.env.HEARTHSOUND_DEV_SERVER ?? 'http://localhost:4327';

export default defineConfig({
  plugins: [
    sveltekit({
      adapter: adapter({
        pages: 'build',
        assets: 'build',
        fallback: 'index.html',
        strict: true
      }),
      paths: {
        relative: false
      }
    })
  ],
  server: {
    proxy: {
      '/rest': devServer,
      '/api': devServer,
      '/healthz': devServer,
      '/readyz': devServer
    }
  },
  test: {
    // The end-to-end suite drives a browser through Playwright's runner; the
    // unit run must not load its specs.
    exclude: ['node_modules/**', 'build/**', '.svelte-kit/**', 'tests/e2e/**'],
    passWithNoTests: true
  }
});
