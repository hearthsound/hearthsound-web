/**
 * The order the ordering step shows, kept for one wizard run.
 *
 * The step seeds the layers from the server and the instances this run
 * configured once. Going back to an earlier step and forward again must show
 * the lists as the administrator left them, deletions included, so the seeded
 * layers, their orders and the instance and plugin lists they were read from
 * live here, owned by the wizard page rather than by the step. A page reload
 * starts a new run and so a new state.
 *
 * Seeding a second time never happens. A later visit absorbs what it finds:
 * an instance configured on that visit joins its layer, a plugin that was
 * checked later appears, and an instance the administrator removed on an
 * earlier visit is never added back.
 */
import type { LayerItem, LayerView } from '#lib/admin/layers';
import { layerItems } from '#lib/admin/layers';
import type { PluginView } from '#lib/admin/plugins';
import type { ProviderView } from '#lib/admin/providers';

import { seededLayers } from '#lib/setup/steps';

/**
 * Returns the key a removed instance is remembered under.
 *
 * @param layer The layer's server name.
 * @param slug The instance's slug.
 * @returns The key, which no layer name and slug can share.
 */
function removedKey(layer: string, slug: string): string {
  return `${layer}\u0000${slug}`;
}

/**
 * Appends the entries a list does not hold yet.
 *
 * @param existing The entries already known, which keep their places.
 * @param incoming The entries to add.
 * @param id Reads the identity of one entry.
 * @returns A new list: the known entries first, then the new ones in order.
 */
function unionBy<T>(existing: readonly T[], incoming: readonly T[], id: (item: T) => string): T[] {
  const known = new Set(existing.map(id));
  const added = incoming.filter((item) => !known.has(id(item)));
  return added.length === 0 ? [...existing] : [...existing, ...added];
}

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
   * The instances the administrator removed, keyed by layer and slug. It is not
   * reactive: the step reads it only while absorbing, never while drawing.
   */
  private removed: Record<string, true> = {};

  /**
   * Seeds the layers, their orders and the lists they were read from. Later
   * calls change nothing, so a deletion made on an earlier visit survives.
   *
   * Seeding happens once; a later visit calls {@link absorb}, which adds what
   * that visit configured and never adds a removed instance back.
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

  /**
   * Adds what a later visit found to the seeded layers.
   *
   * The instances and plugins of that visit join the lists the step was seeded
   * from, an instance that visit configured joins its layer at the end, and an
   * instance the administrator removed earlier stays out.
   *
   * @param layers The layers and the instances the server assigned to them.
   * @param providers Every configured instance now.
   * @param plugins Every installed plugin now.
   * @param selected The plugin ids the administrator checked.
   * @returns The layers whose order grew, which the caller saves at once.
   */
  absorb(
    layers: readonly LayerView[],
    providers: readonly ProviderView[],
    plugins: readonly PluginView[],
    selected: readonly string[]
  ): LayerView[] {
    this.providers = unionBy(this.providers, providers, (provider) => provider.slug);
    this.plugins = unionBy(this.plugins, plugins, (plugin) => plugin.id);

    const names: Record<string, string> = {};
    for (const provider of this.providers) {
      names[provider.slug] = provider.displayName;
    }
    const touched: LayerView[] = [];
    for (const layer of layers) {
      const current = this.orders[layer.layer] ?? [];
      const offered =
        seededLayers([layer], this.providers, this.plugins, selected).at(0)?.instances ?? [];
      const known = (slug: string): boolean => current.some((item) => item.id === slug);
      const add = offered.filter(
        (slug) => !known(slug) && this.removed[removedKey(layer.layer, slug)] !== true
      );
      if (add.length === 0) {
        continue;
      }
      const items = [...current, ...add.map((slug) => ({ id: slug, name: names[slug] ?? slug }))];
      this.orders = { ...this.orders, [layer.layer]: items };
      touched.push({ layer: layer.layer, instances: items.map((item) => item.id) });
    }

    this.layers = layers.map((layer) => ({
      layer: layer.layer,
      instances: (this.orders[layer.layer] ?? []).map((item) => item.id)
    }));
    return touched;
  }

  /**
   * Records that the administrator removed one instance from one layer, so a
   * later absorb does not add it back.
   *
   * @param layer The layer's server name.
   * @param slug The instance that was removed.
   * @returns Nothing.
   */
  remove(layer: string, slug: string): void {
    this.removed[removedKey(layer, slug)] = true;
  }
}
