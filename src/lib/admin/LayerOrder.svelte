<!--
  The order of the instances each layer serves from.

  A layer tries its instances one after the other, so the order in the list is
  the order the server works through: the first is the primary. Dragging an
  entry moves it, Add takes an instance whose plugin provides the layer, and
  Save writes the order of that one layer back to the server.
-->
<script lang="ts">
  import { dndzone } from 'svelte-dnd-action';
  import type { DndEvent } from 'svelte-dnd-action';

  import { nativeClient } from '#lib/api/native';
  import { toasts } from '#lib/stores/toasts.svelte';

  import { layerCandidates, layerItems } from './layers';
  import type { LayerItem, LayerView } from './layers';
  import { problemMessage } from './problem';
  import type { PluginView } from './plugins';
  import type { ProviderView } from './providers';

  /** Props of the view. */
  interface Props {
    /** The layers to order. */
    layers: LayerView[];
    /** Every configured instance. */
    providers: ProviderView[];
    /** Every installed plugin, which names the layers it provides. */
    plugins: PluginView[];
    /** Receives the news that one layer's order was saved. */
    onsaved?: () => void;
    /**
     * Reports the orders after every change, for a caller that saves them in
     * one go; a layer is otherwise written by its own Save command.
     */
    onchange?: (orders: Record<string, LayerItem[]>) => void;
  }

  let { layers, providers, plugins, onsaved = () => {}, onchange = () => {} }: Props = $props();

  /**
   * Returns the entries of every layer.
   *
   * @param layers The layers the server reported.
   * @param providers Every configured instance.
   * @returns One entry list per layer, in the layer's order.
   */
  function seed(
    layers: readonly LayerView[],
    providers: readonly ProviderView[]
  ): Record<string, LayerItem[]> {
    const orders: Record<string, LayerItem[]> = {};
    for (const layer of layers) {
      orders[layer.layer] = layerItems(layer, providers);
    }
    return orders;
  }

  let orders = $derived<Record<string, LayerItem[]>>(seed(layers, providers));
  let choices = $state<Record<string, string>>({});

  $effect(() => {
    onchange(orders);
  });

  /**
   * Returns the handler that keeps a layer's list while an entry is dragged.
   *
   * @param layer The layer being dragged in.
   * @returns The handler.
   */
  function consider(layer: string) {
    return (event: CustomEvent<DndEvent<LayerItem>>): void => {
      orders = { ...orders, [layer]: event.detail.items };
    };
  }

  /**
   * Returns the handler that keeps a layer's list where an entry was dropped.
   *
   * @param layer The layer being dragged in.
   * @returns The handler.
   */
  function finalize(layer: string) {
    return (event: CustomEvent<DndEvent<LayerItem>>): void => {
      orders = { ...orders, [layer]: event.detail.items };
    };
  }

  /**
   * Adds the chosen instance to one layer's list.
   *
   * @param layer The layer to add to.
   */
  function add(layer: LayerView): void {
    const slug = choices[layer.layer] ?? '';
    const chosen = layerCandidates(layer, providers, plugins).find(
      (provider) => provider.slug === slug
    );
    if (chosen === undefined) {
      return;
    }
    orders = {
      ...orders,
      [layer.layer]: [...(orders[layer.layer] ?? []), { id: chosen.slug, name: chosen.displayName }]
    };
    choices = { ...choices, [layer.layer]: '' };
  }

  /**
   * Removes one instance from a layer's list.
   *
   * @param layer The layer to remove from.
   * @param slug The instance to remove.
   */
  function remove(layer: LayerView, slug: string): void {
    orders = {
      ...orders,
      [layer.layer]: (orders[layer.layer] ?? []).filter((item) => item.id !== slug)
    };
  }

  /**
   * Writes one layer's order back to the server.
   *
   * @param layer The layer to save.
   */
  async function save(layer: LayerView): Promise<void> {
    const items = orders[layer.layer] ?? [];
    const answer = await nativeClient.PUT('/api/v1/admin/layers/{layer}', {
      params: { path: { layer: layer.layer } },
      body: items.map((item) => item.id)
    });
    if (answer.data === undefined) {
      toasts.push(problemMessage(answer.error, 'Could not save the layer order.'), 'error');
      return;
    }
    toasts.push(`Saved the order of ${layer.layer}.`);
    onsaved();
  }
</script>

<div class="layers">
  {#each layers as layer (layer.layer)}
    <section class="layer">
      <header class="layer-header">
        <h2 class="layer-name">{layer.layer}</h2>
        <button type="button" class="primary" onclick={() => save(layer)}>Save</button>
      </header>

      <ul
        class="instances"
        aria-label="Instances of {layer.layer}"
        use:dndzone={{ items: orders[layer.layer] ?? [], dropTargetStyle: {} }}
        onconsider={consider(layer.layer)}
        onfinalize={finalize(layer.layer)}
      >
        {#each orders[layer.layer] ?? [] as item (item.id)}
          <li class="instance" aria-label={item.name}>
            <span class="handle" aria-hidden="true">::</span>
            <span class="instance-name">{item.name}</span>
            <button type="button" onclick={() => remove(layer, item.id)}>Remove</button>
          </li>
        {/each}
      </ul>

      {#if (orders[layer.layer] ?? []).length === 0}
        <p class="hint">Nothing serves this layer yet.</p>
      {/if}

      <div class="add">
        <select
          class="input"
          aria-label="Instance to add to {layer.layer}"
          value={choices[layer.layer] ?? ''}
          onchange={(event) => (choices = { ...choices, [layer.layer]: event.currentTarget.value })}
        >
          <option value="">Add an instance</option>
          {#each layerCandidates(layer, providers, plugins) as candidate (candidate.slug)}
            <option value={candidate.slug}>{candidate.displayName}</option>
          {/each}
        </select>
        <button type="button" onclick={() => add(layer)}>Add</button>
      </div>
    </section>
  {/each}
</div>

<style>
  .layers {
    display: flex;
    flex-direction: column;
    gap: var(--space-5);
  }

  .layer {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .layer-header {
    display: flex;
    gap: var(--space-3);
    align-items: baseline;
    justify-content: space-between;
  }

  .layer-name {
    margin: 0;
    font-size: 1rem;
  }

  .instances {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .instance {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    padding: var(--space-2);
    background: var(--color-bg-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: grab;
  }

  .handle {
    color: var(--color-fg-muted);
    font-family: var(--font-mono);
  }

  .instance-name {
    flex: 1 1 auto;
  }

  .add {
    display: flex;
    gap: var(--space-2);
  }

  .input {
    padding: var(--space-1) var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .layer button {
    padding: var(--space-1) var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .layer button.primary {
    color: var(--color-accent-fg);
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .hint {
    margin: 0;
    color: var(--color-fg-muted);
  }
</style>
