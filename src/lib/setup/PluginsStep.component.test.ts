/**
 * Tests for the plugins step's plan: a plan the server never answered reports
 * the sentence the API module words and leaves Continue usable, so the
 * administrator is not stuck behind a spinner, and a plan every plugin answered
 * moves the wizard on.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LayerView } from '#lib/admin/layers';
import type { AvailablePluginView, PluginView } from '#lib/admin/plugins';

import PluginsStep from './PluginsStep.svelte';

/** The plugin endpoints the step calls. */
const plugins = vi.hoisted(() => ({
  installPlugin: vi.fn(),
  installPluginArchive: vi.fn(),
  inspectPluginArchive: vi.fn(),
  listAvailablePlugins: vi.fn(),
  listPlugins: vi.fn(),
  registerRepository: vi.fn(),
  setPluginEnabled: vi.fn(),
  updateRepository: vi.fn()
}));

vi.mock('#lib/admin/api/plugins', () => ({
  installPlugin: plugins.installPlugin,
  installPluginArchive: plugins.installPluginArchive,
  inspectPluginArchive: plugins.inspectPluginArchive,
  listAvailablePlugins: plugins.listAvailablePlugins,
  listPlugins: plugins.listPlugins,
  registerRepository: plugins.registerRepository,
  setPluginEnabled: plugins.setPluginEnabled,
  updateRepository: plugins.updateRepository
}));

/** The layer read the step calls. */
const layers = vi.hoisted(() => ({ listLayers: vi.fn() }));

vi.mock('#lib/admin/api/layers', () => ({ listLayers: layers.listLayers }));

/** The sentence a request that never reached the server shows. */
const NO_ANSWER_TEXT = 'The server did not answer. Try again in a moment.';

/** A plugin an index offers and the server ships. */
const OFFERED: AvailablePluginView = {
  description: 'Searches a catalog.',
  homepage: 'http://localhost/example',
  id: 'app.hearthsound.deezer',
  isDefault: true,
  license: 'AGPL-3.0-or-later',
  name: 'Deezer',
  official: true,
  permissions: [],
  provides: ['catalog'],
  verified: true,
  version: '1.0.0'
};

/** The plugin as the server lists it once the plan installed it. */
const INSTALLED: PluginView = {
  api: '1',
  enabled: true,
  id: OFFERED.id,
  installedAt: 1_000,
  isDefault: true,
  name: OFFERED.name,
  provides: ['catalog'],
  requestedPermissions: [],
  source: 'official',
  state: 'enabled',
  version: '1.0.0'
};

/** The layers the server lists. */
const LAYERS: LayerView[] = [{ layer: 'catalog', instances: [] }];

beforeEach(() => {
  plugins.listPlugins.mockResolvedValue({ ok: true, value: [] as PluginView[] });
  plugins.listAvailablePlugins.mockResolvedValue({
    ok: true,
    value: { plugins: [OFFERED], errors: [] }
  });
  layers.listLayers.mockResolvedValue({ ok: true, value: LAYERS });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the plugins step', () => {
  it('reports a plan the server never answered and leaves Continue usable', async () => {
    plugins.installPlugin.mockRejectedValue(new Error('network down'));
    const oncontinue = vi.fn();

    render(PluginsStep, { props: { selection: [], oncontinue } });

    expect(await screen.findByText('Deezer')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Install and continue' }));

    expect(await screen.findByText(NO_ANSWER_TEXT)).toBeTruthy();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Install and continue' }).getAttribute('aria-busy')
      ).toBeNull()
    );
    expect(oncontinue).not.toHaveBeenCalled();
  });

  it('moves on when every plugin in the plan answered', async () => {
    plugins.installPlugin.mockResolvedValue({ ok: true, value: INSTALLED });
    const oncontinue = vi.fn();

    render(PluginsStep, { props: { selection: [], oncontinue } });

    expect(await screen.findByText('Deezer')).toBeTruthy();
    await fireEvent.click(screen.getByRole('button', { name: 'Install and continue' }));

    await waitFor(() => expect(oncontinue).toHaveBeenCalledTimes(1));
  });
});
