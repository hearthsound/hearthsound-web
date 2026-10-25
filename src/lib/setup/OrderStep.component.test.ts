/**
 * Tests for the order step's saves: a layer the server refused keeps its line
 * and the step, Continue tries that layer again, and a layer that answers
 * clears its line and lets the wizard move on.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LayerView } from '#lib/admin/layers';
import type { PluginView } from '#lib/admin/plugins';
import type { ProviderView } from '#lib/admin/providers';

import OrderStep from './OrderStep.svelte';
import { OrderState } from './order-state.svelte';

/** The layer endpoints the step calls. */
const layers = vi.hoisted(() => ({
  listLayers: vi.fn(),
  saveLayerOrder: vi.fn()
}));

vi.mock('#lib/admin/api/layers', () => ({
  listLayers: layers.listLayers,
  saveLayerOrder: layers.saveLayerOrder
}));

/** The plugin read the step calls. */
const plugins = vi.hoisted(() => ({ listPlugins: vi.fn() }));

vi.mock('#lib/admin/api/plugins', () => ({ listPlugins: plugins.listPlugins }));

/** The instance reads the step and its dialog call. */
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

/** An installed plugin that serves one layer. */
function installed(id: string, provides: string[]): PluginView {
  return {
    api: '1',
    enabled: true,
    id,
    installedAt: 1_000,
    isDefault: false,
    name: id,
    provides,
    requestedPermissions: [],
    source: 'official',
    state: 'enabled',
    version: '1.0.0'
  };
}

/** A configured instance. */
function provider(slug: string, pluginId: string, createdAt: number): ProviderView {
  return {
    createdAt,
    displayName: slug,
    enabled: true,
    hostConfig: {},
    pluginId,
    serverConfig: {},
    slug,
    updatedAt: createdAt
  };
}

/** A layer and the instances the server assigned to it. */
function layer(name: string, instances: string[]): LayerView {
  return { layer: name, instances };
}

/** The layers the server lists, with nothing assigned yet. */
const LAYERS = [layer('catalog', []), layer('acquisition', [])];
/** The instances this run configured. */
const PROVIDERS = [
  provider('catalog-one', 'app.example.catalog', 1),
  provider('slskd', 'app.example.slskd', 2)
];
/** The plugins that serve those instances. */
const PLUGINS = [
  installed('app.example.catalog', ['catalog']),
  installed('app.example.slskd', ['acquisition'])
];
/** The plugin ids the administrator checked. */
const SELECTED = ['app.example.catalog', 'app.example.slskd'];

/** The answer a save the server refused gives. */
const REFUSED = { ok: false as const, message: 'Could not save the layer order.', status: 500 };

/**
 * Returns the number of saves one layer was sent.
 *
 * @param name The layer's server name.
 * @returns How many times the step saved it.
 */
function savesOf(name: string): number {
  return layers.saveLayerOrder.mock.calls.filter(([given]) => given === name).length;
}

beforeEach(() => {
  layers.listLayers.mockResolvedValue({ ok: true, value: LAYERS });
  plugins.listPlugins.mockResolvedValue({ ok: true, value: PLUGINS });
  providers.listProviders.mockResolvedValue({ ok: true, value: PROVIDERS });
  layers.saveLayerOrder.mockImplementation(async (name: string) => ({
    ok: true as const,
    value: layer(name, [])
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('the order step', () => {
  it('keeps a refused layer and tries it again on Continue', async () => {
    layers.saveLayerOrder.mockImplementation(async (name: string) =>
      name === 'acquisition' ? REFUSED : { ok: true as const, value: layer(name, []) }
    );
    const oncontinue = vi.fn();

    render(OrderStep, { props: { order: new OrderState(), selected: SELECTED, oncontinue } });

    // The catalog layer answered, so only the refused one is named.
    expect(await screen.findByText('Acquisition: Could not save the layer order.')).toBeTruthy();
    expect(screen.queryByText(/^Catalog: /)).toBeNull();

    const before = savesOf('acquisition');
    await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(savesOf('acquisition')).toBe(before + 1));
    expect(oncontinue).not.toHaveBeenCalled();
    expect(screen.getByText('Acquisition: Could not save the layer order.')).toBeTruthy();

    // The server answers the retry, so the step leaves and the line is gone.
    layers.saveLayerOrder.mockImplementation(async (name: string) => ({
      ok: true as const,
      value: layer(name, [])
    }));
    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Continue' });
      expect(button.getAttribute('aria-busy')).toBeNull();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(oncontinue).toHaveBeenCalledTimes(1));
  });

  it('moves on at once when every layer was saved', async () => {
    const oncontinue = vi.fn();

    render(OrderStep, { props: { order: new OrderState(), selected: SELECTED, oncontinue } });

    await waitFor(() => expect(savesOf('catalog')).toBe(1));
    await waitFor(() => {
      const button = screen.getByRole('button', { name: 'Continue' });
      expect(button.getAttribute('aria-busy')).toBeNull();
    });
    await fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(oncontinue).toHaveBeenCalledTimes(1));
  });

  it('absorbs an instance configured on a later visit into its layer', async () => {
    const order = new OrderState();
    order.seed(LAYERS, [], PLUGINS, SELECTED);

    render(OrderStep, { props: { order, selected: SELECTED, oncontinue: vi.fn() } });

    expect(await screen.findAllByText('catalog-one')).toHaveLength(2);
    expect(screen.getAllByText('slskd')).toHaveLength(2);
    await waitFor(() => expect(savesOf('catalog')).toBe(1));
  });
});
