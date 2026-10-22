/**
 * Tests for the entries a layer shows and the instances it may still take.
 */
import { describe, expect, it } from 'vitest';

import { layerCandidates, layerItems } from './layers';
import type { LayerView } from './layers';
import type { PluginView } from './plugins';
import type { ProviderView } from './providers';

/**
 * Builds a configured instance.
 *
 * @param slug The instance slug.
 * @param pluginId The plugin it is configured from.
 * @returns The instance.
 */
function provider(slug: string, pluginId: string): ProviderView {
  return {
    slug,
    pluginId,
    displayName: slug.toUpperCase(),
    enabled: true,
    createdAt: 1,
    updatedAt: 1,
    hostConfig: {},
    serverConfig: {}
  };
}

/**
 * Builds an installed plugin.
 *
 * @param id The plugin id.
 * @param provides The layers it provides.
 * @returns The plugin.
 */
function plugin(id: string, provides: string[]): PluginView {
  return {
    id,
    name: id,
    version: '1.0.0',
    api: '1',
    enabled: true,
    isDefault: false,
    installedAt: 1,
    provides,
    requestedPermissions: [],
    source: 'official',
    state: 'enabled'
  };
}

/** A layer holding one of two catalog instances. */
const layer: LayerView = { layer: 'catalog', instances: ['deezer'] };

describe('layer lists', () => {
  it('names the assigned instances in the layer order', () => {
    const providers = [provider('deezer', 'app.hearthsound.deezer'), provider('other', 'x.y')];

    expect(layerItems({ layer: 'catalog', instances: ['other', 'deezer'] }, providers)).toEqual([
      { id: 'other', name: 'OTHER' },
      { id: 'deezer', name: 'DEEZER' }
    ]);
  });

  it('shows the slug of an instance the server no longer reports', () => {
    expect(layerItems(layer, [])).toEqual([{ id: 'deezer', name: 'deezer' }]);
  });

  it('offers only unassigned instances whose plugin provides the layer', () => {
    const providers = [
      provider('deezer', 'app.hearthsound.deezer'),
      provider('musicbrainz', 'app.hearthsound.musicbrainz'),
      provider('torrent', 'app.example.torrent')
    ];
    const plugins = [
      plugin('app.hearthsound.deezer', ['catalog']),
      plugin('app.hearthsound.musicbrainz', ['metadata']),
      plugin('app.example.torrent', ['catalog'])
    ];

    expect(layerCandidates(layer, providers, plugins).map((entry) => entry.slug)).toEqual([
      'torrent'
    ]);
  });
});
