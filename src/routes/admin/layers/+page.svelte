<!--
  The order of the instances each layer serves from.

  Every layer the server can drive is listed with the instances assigned to it,
  so an administrator sees which catalog, which metadata source and which
  acquisition backend is in charge, and can move one up or down, add another,
  or take one out.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import LayerOrder from '#lib/admin/LayerOrder.svelte';
  import type { LayerView } from '#lib/admin/layers';
  import { problemMessage } from '#lib/admin/problem';
  import type { PluginView } from '#lib/admin/plugins';
  import type { ProviderView } from '#lib/admin/providers';
  import { nativeClient } from '#lib/api/native';

  let layers = $state<LayerView[]>([]);
  let providers = $state<ProviderView[]>([]);
  let plugins = $state<PluginView[]>([]);
  let failure = $state<string | null>(null);

  onMount(() => {
    void load();
  });

  /** Loads the layers, the instances and the plugins that name them. */
  async function load(): Promise<void> {
    const [ordered, instances, installed] = await Promise.all([
      nativeClient.GET('/api/v1/admin/layers'),
      nativeClient.GET('/api/v1/admin/providers'),
      nativeClient.GET('/api/v1/admin/plugins')
    ]);
    if (ordered.data === undefined) {
      failure = problemMessage(ordered.error, 'Could not load the layers.');
      return;
    }
    failure = null;
    layers = ordered.data.layers;
    providers = instances.data?.providers ?? [];
    plugins = installed.data?.plugins ?? [];
  }
</script>

<svelte:head>
  <title>Layers - Hearthsound</title>
</svelte:head>

<section class="page">
  <h1>Layers</h1>
  <p class="hint">
    A layer tries its instances in the order they stand in; the first is the one that serves.
  </p>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  <LayerOrder {layers} {providers} {plugins} onsaved={() => void load()} />
</section>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .page h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .hint {
    margin: 0;
    color: var(--color-fg-muted);
  }

  .failure {
    margin: 0;
    color: var(--color-danger);
  }
</style>
