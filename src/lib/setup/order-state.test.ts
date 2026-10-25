/**
 * Tests for the order state of the ordering step: the layers it seeds once per
 * wizard run, the deletions, orders and instance lists that survive a return to
 * the step, and what a later visit absorbs into the seeded lists.
 */
import { describe, expect, it } from 'vitest';

import type { LayerView } from '#lib/admin/layers';
import type { PluginView } from '#lib/admin/plugins';
import type { ProviderView } from '#lib/admin/providers';

import { OrderState } from './order-state.svelte';

/** An installed plugin that provides the layers named. */
function plugin(id: string, provides: string[]): PluginView {
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

/** A configured instance, unless a test says otherwise. */
function provider(overrides: Partial<ProviderView> = {}): ProviderView {
  return {
    createdAt: 1_000,
    displayName: 'Example catalog',
    enabled: true,
    hostConfig: {},
    pluginId: 'app.example.catalog',
    serverConfig: {},
    slug: 'catalog',
    updatedAt: 1_000,
    ...overrides
  };
}

/** A layer with its assignments. */
function layer(name: string, instances: string[]): LayerView {
  return { layer: name, instances };
}

const plugins = [
  plugin('app.example.catalog', ['catalog']),
  plugin('app.example.slskd', ['acquisition'])
];
const selected = ['app.example.catalog', 'app.example.slskd'];
const providers = [
  provider({ slug: 'catalog-one', pluginId: 'app.example.catalog', createdAt: 1 }),
  provider({
    slug: 'slskd',
    displayName: 'slskd',
    pluginId: 'app.example.slskd',
    createdAt: 2
  })
];

describe('the order state', () => {
  it('seeds the configured instances into their layers and asks for their saves', () => {
    const state = new OrderState();

    const saved = state.seed(
      [layer('catalog', []), layer('acquisition', [])],
      providers,
      plugins,
      selected
    );

    expect(state.seeded).toBe(true);
    expect(state.orders.catalog.map((item) => item.id)).toEqual(['catalog-one']);
    expect(state.orders.acquisition.map((item) => item.id)).toEqual(['slskd']);
    expect(saved.map((entry) => entry.layer)).toEqual(['catalog', 'acquisition']);
  });

  it('asks for no save of a layer the server already holds in that order', () => {
    const state = new OrderState();

    const saved = state.seed(
      [layer('catalog', ['catalog-one']), layer('acquisition', [])],
      providers,
      plugins,
      selected
    );

    expect(saved.map((entry) => entry.layer)).toEqual(['acquisition']);
  });

  it('keeps a deletion when the step is seeded again', () => {
    const state = new OrderState();
    state.seed([layer('catalog', []), layer('acquisition', [])], providers, plugins, selected);

    state.orders = { ...state.orders, catalog: [] };
    const saved = state.seed(
      [layer('catalog', []), layer('acquisition', [])],
      providers,
      plugins,
      selected
    );

    expect(saved).toEqual([]);
    expect(state.orders.catalog).toEqual([]);
    expect(state.orders.acquisition.map((item) => item.id)).toEqual(['slskd']);
  });

  it('keeps the lists it was seeded from, whatever a later seed is given', () => {
    const state = new OrderState();
    state.seed([layer('catalog', [])], providers, plugins, selected);

    state.seed([layer('catalog', [])], [], [], []);

    expect(state.providers.map((entry) => entry.slug)).toEqual(['catalog-one', 'slskd']);
    expect(state.plugins.map((entry) => entry.id)).toEqual([
      'app.example.catalog',
      'app.example.slskd'
    ]);
  });

  it('absorbs an instance configured on a later visit into its layer', () => {
    const state = new OrderState();
    state.seed([layer('catalog', []), layer('acquisition', [])], providers, plugins, selected);

    const later = [
      ...providers,
      provider({ slug: 'catalog-two', pluginId: 'app.example.catalog', createdAt: 3 })
    ];
    const touched = state.absorb(
      [layer('catalog', []), layer('acquisition', [])],
      later,
      plugins,
      selected
    );

    expect(touched.map((entry) => entry.layer)).toEqual(['catalog']);
    expect(state.orders.catalog.map((item) => item.id)).toEqual(['catalog-one', 'catalog-two']);
    expect(state.orders.catalog.map((item) => item.name)).toEqual([
      'Example catalog',
      'Example catalog'
    ]);
  });

  it('does not add back an instance the administrator removed', () => {
    const state = new OrderState();
    state.seed([layer('catalog', [])], providers, plugins, selected);
    state.remove('catalog', 'catalog-one');
    state.orders = { ...state.orders, catalog: [] };

    const touched = state.absorb([layer('catalog', [])], providers, plugins, selected);

    expect(touched).toEqual([]);
    expect(state.orders.catalog).toEqual([]);
  });

  it('adds a layer of a plugin the administrator checked later', () => {
    const state = new OrderState();
    state.seed([layer('catalog', []), layer('acquisition', [])], providers, plugins, []);

    expect(state.orders.catalog).toEqual([]);
    const touched = state.absorb(
      [layer('catalog', []), layer('acquisition', [])],
      providers,
      plugins,
      ['app.example.catalog']
    );

    expect(touched.map((entry) => entry.layer)).toEqual(['catalog']);
    expect(state.orders.catalog.map((item) => item.id)).toEqual(['catalog-one']);
  });
});
