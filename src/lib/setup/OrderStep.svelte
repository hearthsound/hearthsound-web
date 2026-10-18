<!--
  The order step: which instance serves each layer first.

  Every layer that holds an instance is listed with it, the instances this run
  configured joining the layers their plugin provides in the order they were
  created. Dragging an entry moves it and the first is the one that serves;
  continuing writes the order of every layer shown.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import LayerOrder from '#lib/admin/LayerOrder.svelte';
  import type { LayerItem, LayerView } from '#lib/admin/layers';
  import { layerItems } from '#lib/admin/layers';
  import { problemMessage } from '#lib/admin/problem';
  import type { PluginView } from '#lib/admin/plugins';
  import type { ProviderView } from '#lib/admin/providers';
  import { nativeClient } from '#lib/api/native';
  import { seededLayers } from '#lib/setup/steps';

  /** Props of the step. */
  interface Props {
    /** The plugin ids the administrator checked. */
    selected: string[];
    /** Moves on to the next step. */
    oncontinue: () => void;
  }

  let { selected, oncontinue }: Props = $props();

  let layers = $state<LayerView[]>([]);
  let providers = $state<ProviderView[]>([]);
  let plugins = $state<PluginView[]>([]);
  let orders = $state<Record<string, LayerItem[]>>({});
  let failure = $state<string | null>(null);
  let busy = $state(false);

  onMount(async () => {
    const [ordered, instances, installed] = await Promise.all([
      nativeClient.GET('/api/v1/admin/layers'),
      nativeClient.GET('/api/v1/admin/providers'),
      nativeClient.GET('/api/v1/admin/plugins')
    ]);
    if (ordered.data === undefined) {
      failure = problemMessage(ordered.error, 'Could not load the layers.');
      return;
    }
    providers = instances.data?.providers ?? [];
    plugins = installed.data?.plugins ?? [];
    layers = seededLayers(ordered.data.layers, providers, plugins, selected);
    orders = Object.fromEntries(layers.map((layer) => [layer.layer, layerItems(layer, providers)]));
  });

  /** Writes the order of every layer shown. */
  async function apply(): Promise<void> {
    busy = true;
    for (const layer of layers) {
      const answer = await nativeClient.PUT('/api/v1/admin/layers/{layer}', {
        params: { path: { layer: layer.layer } },
        body: (orders[layer.layer] ?? []).map((item) => item.id)
      });
      if (answer.data === undefined) {
        busy = false;
        failure = problemMessage(answer.error, 'Could not save the layer order.');
        return;
      }
    }
    busy = false;
    oncontinue();
  }
</script>

<section class="step">
  <h2>Order</h2>
  <p>
    A layer tries its instances in the order they stand in, and the first is the one that serves.
    Drag an entry to move it, remove one you do not want to serve, or add another instance.
  </p>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  {#if layers.length === 0 && failure === null}
    <p class="hint">No layer has an instance yet, so there is nothing to order.</p>
  {:else}
    <LayerOrder {layers} {providers} {plugins} onchange={(next) => (orders = next)} />
  {/if}

  <div class="commands">
    <button class="primary" type="button" onclick={apply} disabled={busy}>Continue</button>
  </div>
</section>

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .step h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .step p {
    margin: 0;
  }

  .hint {
    margin: 0;
    color: var(--color-fg-muted);
  }

  .failure {
    margin: 0;
    color: var(--color-danger);
  }

  .commands {
    display: flex;
    gap: var(--space-2);
  }

  .commands button {
    padding: var(--space-2) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .commands .primary {
    color: var(--color-accent-fg);
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .commands button:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
