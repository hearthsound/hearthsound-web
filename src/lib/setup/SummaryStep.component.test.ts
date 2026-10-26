/**
 * Tests for the summary step: a readiness probe that never answered stops
 * spinning and offers Retry, the required layers nothing serves are named above
 * the instances, a plugin list the server refused invents no warning, and a
 * folder whose last scan failed says so instead of waiting for a first one.
 */
import { cleanup, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FolderView } from '#lib/admin/folders';
import type { PluginView } from '#lib/admin/plugins';
import type { ProviderView } from '#lib/admin/providers';

import SummaryStep from './SummaryStep.svelte';

/** The instance reads the step calls. */
const providers = vi.hoisted(() => ({
  listProviders: vi.fn(),
  checkProviderHealth: vi.fn()
}));

vi.mock('#lib/admin/api/providers', () => ({
  listProviders: providers.listProviders,
  checkProviderHealth: providers.checkProviderHealth,
  createProvider: vi.fn(),
  updateProvider: vi.fn()
}));

/** The folder read the step calls. */
const folders = vi.hoisted(() => ({ listFolders: vi.fn() }));

vi.mock('#lib/admin/api/folders', () => ({
  listFolders: folders.listFolders,
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn()
}));

/** The plugin read the warnings come from. */
const plugins = vi.hoisted(() => ({ listPlugins: vi.fn() }));

vi.mock('#lib/admin/api/plugins', () => ({ listPlugins: plugins.listPlugins }));

/** The event stream the step listens to, which a case publishes a scan frame on. */
const stream = vi.hoisted(() => ({
  publish: null as ((event: unknown) => void) | null
}));

vi.mock('#lib/stores/events.svelte', () => ({
  events: {
    on: (_type: string, handler: (event: unknown) => void) => {
      stream.publish = handler;
      return () => {
        stream.publish = null;
      };
    }
  }
}));

/** The three sentences an empty required layer shows. */
const WARNINGS = [
  'No catalog source yet - online search will find nothing.',
  'No metadata source yet - tags and artwork will not be enriched.',
  'No download source yet - songs that are not on the server cannot be played or saved.'
];

/** Every plugin that could serve a required layer. */
const LAYER_PLUGINS: PluginView[] = [
  {
    api: '1',
    enabled: true,
    id: 'app.example.catalog',
    installedAt: 1_000,
    isDefault: false,
    name: 'Catalog',
    provides: ['catalog'],
    requestedPermissions: [],
    source: 'official',
    state: 'enabled',
    version: '1.0.0'
  },
  {
    api: '1',
    enabled: true,
    id: 'app.example.metadata',
    installedAt: 1_000,
    isDefault: false,
    name: 'Metadata',
    provides: ['metadata'],
    requestedPermissions: [],
    source: 'official',
    state: 'enabled',
    version: '1.0.0'
  },
  {
    api: '1',
    enabled: true,
    id: 'app.example.slskd',
    installedAt: 1_000,
    isDefault: false,
    name: 'slskd',
    provides: ['acquisition'],
    requestedPermissions: [],
    source: 'official',
    state: 'enabled',
    version: '1.0.0'
  }
];

/** The answer the readiness probe gives while the server is fine. */
const READY = { ok: true, statusText: 'OK', text: () => Promise.resolve('ready') };

/** A folder whose last scan failed, with the sentence the server stores for it. */
const FAILED_FOLDER: FolderView = {
  createdAt: 1_000,
  generic: false,
  id: 'lf_one',
  lastScanAt: 2_000,
  lastScanError:
    'Scan failed: reading `/fixtures/flac` failed: No such file or directory (os error 2).',
  name: 'Music',
  path: '/fixtures',
  watch: false
};

beforeEach(() => {
  providers.listProviders.mockResolvedValue({ ok: true, value: [] as ProviderView[] });
  providers.checkProviderHealth.mockResolvedValue({
    ok: true,
    value: { checkedAt: 1_000, detail: '', ok: true, slug: 'deezer' }
  });
  plugins.listPlugins.mockResolvedValue({ ok: true, value: LAYER_PLUGINS });
  folders.listFolders.mockResolvedValue({ ok: true, value: [] as FolderView[] });
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(READY))
  );
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('the summary step', () => {
  it('stops a readiness probe that never answered and offers Retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('offline')))
    );

    render(SummaryStep, { props: { oncontinue: vi.fn() } });

    expect(await screen.findByText('Not ready - The server did not answer.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('names every required layer nothing serves above the instances', async () => {
    render(SummaryStep, { props: { oncontinue: vi.fn() } });

    for (const warning of WARNINGS) {
      expect(await screen.findByText(warning)).toBeTruthy();
    }
    expect(screen.getByText('No instance is configured yet.')).toBeTruthy();
  });

  it('invents no warning when the plugin list could not be read', async () => {
    plugins.listPlugins.mockResolvedValue({
      ok: false,
      message: 'Could not load the plugins.',
      status: 500
    });

    render(SummaryStep, { props: { oncontinue: vi.fn() } });

    expect(await screen.findByText('No instance is configured yet.')).toBeTruthy();
    expect(screen.queryByText(WARNINGS[0])).toBeNull();
  });

  it('reports a folder whose last scan failed in the error style, in the server words', async () => {
    folders.listFolders.mockResolvedValue({ ok: true, value: [FAILED_FOLDER] });

    render(SummaryStep, { props: { oncontinue: vi.fn() } });

    // The stored sentence arrives complete, so no prefix is added to it.
    const line = await screen.findByText(FAILED_FOLDER.lastScanError as string);
    expect(line.className).toContain('hs-setting-row__subtitle--error');
    expect(screen.queryByText('Waiting for its first scan')).toBeNull();
    expect(screen.queryByText(`Scan failed: ${FAILED_FOLDER.lastScanError}`)).toBeNull();
  });

  it('shows a scan that finished with a warning as one sentence', async () => {
    folders.listFolders.mockResolvedValue({ ok: true, value: [FAILED_FOLDER] });

    render(SummaryStep, { props: { oncontinue: vi.fn() } });
    await screen.findByText(FAILED_FOLDER.lastScanError as string);

    const warning =
      'Nothing was removed: the folder root is empty, so the disk may not be mounted.';
    stream.publish?.({
      id: 7,
      type: 'scan.progress',
      at: 3_000,
      data: {
        folderId: FAILED_FOLDER.id,
        phase: 'done',
        filesSeen: 0,
        filesDone: 0,
        error: warning
      }
    });

    const line = await screen.findByText(warning);
    expect(line.className).toContain('hs-setting-row__subtitle--error');
  });
});
