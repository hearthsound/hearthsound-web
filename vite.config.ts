/**
 * Vite configuration: the SvelteKit plugin with the application's build options,
 * the development proxy that forwards API and media requests to a locally running
 * Hearthsound server, and the Vitest configuration for unit and component tests.
 *
 * Vitest runs two projects. `unit` runs every `*.test.ts` in Node. `component`
 * runs `*.component.test.ts` files, which mount `.svelte` components, in jsdom;
 * `svelteTesting()` resolves Svelte's browser build for that project only (the
 * Node project must keep the server build, which `$app/*` modules need) and
 * unmounts components after each test.
 *
 * SvelteKit 3 reads its configuration from this file rather than from a
 * `svelte.config.js`; the options below are the client's static adapter and
 * root-relative path settings.
 */
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
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
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.component.test.ts']
        }
      },
      {
        extends: true,
        plugins: [svelteTesting()],
        test: {
          name: 'component',
          environment: 'jsdom',
          include: ['src/**/*.component.test.ts']
        }
      }
    ]
  }
});
