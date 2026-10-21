/**
 * The order the ordering step shows, kept for one wizard run.
 *
 * The step seeds the layers from the server and the instances this run
 * configured once. Going back to an earlier step and forward again must show
 * the lists as the administrator left them, deletions included, so the seeded
 * layers, their orders and the instance and plugin lists they were read from
 * live here, owned by the wizard page rather than by the step. A page reload
 * starts a new run and so a new state.
 */
import type { LayerItem, LayerView } from '#lib/admin/layers';
import { layerItems } from '#lib/admin/layers';
import type { PluginView } from '#lib/admin/plugins';
import type { ProviderView } from '#lib/admin/providers';

import { seededLayers } from '#lib/setup/steps';

/** The layer orders of one wizard run, seeded once. */
export class OrderState {
  /** Whether the layers were seeded, which happens once per run. */
  seeded = $state(false);
  /** The layers the step lists, in the order the server lists them. */
  layers = $state<LayerView[]>([]);
  /** Each layer's order, by the layer's server name. */
  orders = $state<Record<string, LayerItem[]>>({});
  /** Every configured instance, including the ones the step added. */
  providers = $state<ProviderView[]>([]);
  /** Every installed plugin, which names the layers it provides. */
  plugins = $state<PluginView[]>([]);
  /** The saves in flight, chained so they reach the server in order. */
  saving: Promise<unknown> = Promise.resolve();

  /**
   * Seeds the layers, their orders and the lists they were read from. Later
   * calls change nothing, so a deletion made on an earlier visit survives.
   *
   * @param layers The layers and the instances the server assigned to them.
   * @param providers Every configured instance.
   * @param plugins Every installed plugin.
   * @param selected The plugin ids the administrator checked.
   * @returns The layers whose seeded order differs from the server's, which the
   *   caller saves at once; empty when the state was already seeded.
   */
  seed(
    layers: readonly LayerView[],
    providers: readonly ProviderView[],
    plugins: readonly PluginView[],
    selected: readonly string[]
  ): LayerView[] {
    if (this.seeded) {
      return [];
    }
    this.providers = [...providers];
    this.plugins = [...plugins];
    this.layers = seededLayers(layers, this.providers, this.plugins, selected);
    this.orders = Object.fromEntries(
      this.layers.map((layer) => [layer.layer, layerItems(layer, this.providers)])
    );
    this.seeded = true;

    const saved: LayerView[] = [];
    for (const layer of this.layers) {
      const before = layers.find((entry) => entry.layer === layer.layer)?.instances ?? [];
      if (before.join(' ') !== layer.instances.join(' ')) {
        saved.push(layer);
      }
    }
    return saved;
  }
}
