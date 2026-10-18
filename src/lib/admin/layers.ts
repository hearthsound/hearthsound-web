/**
 * The instances assigned to each layer.
 *
 * A layer tries its instances in order, so the order an administrator drags
 * them into is the order the server serves from. The views render a layer as a
 * list of the instances it holds and offer the instances that could still be
 * added, which are the configured ones whose plugin provides the layer.
 */
import type { components } from '#lib/api/schema';

import type { PluginView } from './plugins';
import type { ProviderView } from './providers';

/** One layer and the instances assigned to it. */
export type LayerView = components['schemas']['LayerView'];

/** One entry of a layer's list. */
export interface LayerItem {
  /** The instance slug, which the list keys on. */
  id: string;
  /** The name shown for the instance. */
  name: string;
}

/**
 * Returns the entries of one layer's list.
 *
 * @param layer The layer to render.
 * @param providers Every configured instance, which names them.
 * @returns One entry per assigned instance, in the layer's order.
 */
export function layerItems(layer: LayerView, providers: readonly ProviderView[]): LayerItem[] {
  const names = new Map(providers.map((provider) => [provider.slug, provider.displayName]));
  return layer.instances.map((slug) => ({ id: slug, name: names.get(slug) ?? slug }));
}

/**
 * Returns the instances that could still be added to one layer.
 *
 * An instance is offered when its plugin provides the layer and the layer does
 * not hold it yet.
 *
 * @param layer The layer to add to.
 * @param providers Every configured instance.
 * @param plugins Every installed plugin, which names the layers it provides.
 * @returns The instances to offer, in the order the server lists them.
 */
export function layerCandidates(
  layer: LayerView,
  providers: readonly ProviderView[],
  plugins: readonly PluginView[]
): ProviderView[] {
  const byId = new Map(plugins.map((plugin) => [plugin.id, plugin]));
  return providers.filter((provider) => {
    if (layer.instances.includes(provider.slug)) {
      return false;
    }
    const plugin = byId.get(provider.pluginId);
    return plugin !== undefined && plugin.provides.includes(layer.layer);
  });
}
