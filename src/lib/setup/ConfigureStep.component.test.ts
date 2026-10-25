/**
 * Tests for the configuration step: an instance list the server refused is
 * reported with a Retry instead of being read as an empty list, and the warning
 * of a required layer nothing serves leaves once the step saved an instance for
 * it.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PluginView } from '#lib/admin/plugins';
import type { ProviderView } from '#lib/admin/providers';

import ConfigureStep from './ConfigureStep.svelte';

/** The plugin read the step calls. */
const plugins = vi.hoisted(() => ({ listPlugins: vi.fn() }));

vi.mock('#lib/admin/api/plugins', () => ({ listPlugins: plugins.listPlugins }));

/** The instance reads and the dialog's save the step calls. */
const providers = vi.hoisted(() => ({
  listProviders: vi.fn(),
  createProvider: vi.fn(),
  updateProvider: vi.fn(),
  checkProviderHealth: vi.fn()
}));

vi.mock('#lib/admin/api/providers', () => ({
  listProviders: providers.listProviders,
  createProvider: providers.createProvider,
  updateProvider: providers.updateProvider,
  checkProviderHealth: providers.checkProviderHealth
}));

/** The catalog plugin the administrator checked. */
const CATALOG: PluginView = {
  api: '1',
  enabled: true,
  id: 'app.hearthsound.deezer',
  installedAt: 1_000,
  isDefault: true,
  name: 'Deezer',
  provides: ['catalog'],
  requestedPermissions: [],
  source: 'official',
  state: 'enabled',
  version: '1.0.0'
};

/** The instance the dialog saves. */
const SAVED: ProviderView = {
  createdAt: 2_000,
  displayName: 'Deezer',
  enabled: true,
  hostConfig: {},
  pluginId: CATALOG.id,
  serverConfig: {},
  slug: 'deezer',
  updatedAt: 2_000
};

/** The sentence the catalog layer shows while nothing serves it. */
const CATALOG_WARNING = 'No catalog source yet - online search will find nothing.';

beforeEach(() => {
  plugins.listPlugins.mockResolvedValue({ ok: true, value: [CATALOG] });
  providers.listProviders.mockResolvedValue({ ok: true, value: [] as ProviderView[] });
  providers.createProvider.mockResolvedValue({ ok: true, value: SAVED });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the configuration step', () => {
  it('reports an instance list the server refused and reads it again on Retry', async () => {
    providers.listProviders.mockResolvedValue({
      ok: false,
      message: 'Could not load the instances.',
      status: 500
    });

    render(ConfigureStep, { props: { selection: [CATALOG.id], oncontinue: vi.fn() } });

    expect(await screen.findByText('Could not load the instances.')).toBeTruthy();
    // The read failed, so no layer is claimed to be unserved.
    expect(screen.queryByText(CATALOG_WARNING)).toBeNull();

    providers.listProviders.mockResolvedValue({ ok: true, value: [] });
    await fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(screen.queryByText('Could not load the instances.')).toBeNull());
    expect(providers.listProviders).toHaveBeenCalledTimes(2);
    // The list answered, so the warning is real now and Continue stays usable.
    expect(await screen.findByText(CATALOG_WARNING)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue' }).hasAttribute('disabled')).toBe(false);
  });

  it('drops the warning of a layer once its instance is saved', async () => {
    render(ConfigureStep, { props: { selection: [CATALOG.id], oncontinue: vi.fn() } });

    expect(await screen.findByText(CATALOG_WARNING)).toBeTruthy();

    await fireEvent.click(screen.getByRole('button', { name: 'Add instance' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add instance' });
    const form = dialog.querySelector('form');
    if (form === null) {
      throw new Error('The instance dialog drew no form.');
    }
    await fireEvent.submit(form);

    await waitFor(() => expect(screen.queryByText(CATALOG_WARNING)).toBeNull());
    expect(screen.getByText('app.hearthsound.deezer - in service as deezer')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });
});
