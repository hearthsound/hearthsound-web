<!--
  The order of the instances each layer serves from (p25b A, p05b-r1, k30-r1).

  One group per layer, headed with the capitalised layer name: each row is the
  setup Order row, with its always-visible drag handle, position, name over mono
  slug, health pill and bin. Every drag, removal or addition is written at once
  and reported with the saved toast; there is no Save button. The group's last
  row adds an instance from an installed plugin that provides the layer.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { IconName } from '@hearthsound/design/icons';

  import ProviderForm from '#lib/admin/ProviderForm.svelte';
  import { layerItems } from '#lib/admin/layers';
  import type { LayerItem, LayerView } from '#lib/admin/layers';
  import { problemMessage } from '#lib/admin/problem';
  import type { PluginView } from '#lib/admin/plugins';
  import type { ProviderView } from '#lib/admin/providers';
  import { nativeClient } from '#lib/api/native';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Button from '#lib/ui/Button.svelte';
  import ListRow from '#lib/ui/ListRow.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import type { PillTone } from '#lib/ui/Pill.svelte';
  import ReorderList from '#lib/ui/ReorderList.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  const shell = getShellNavigation();

  let layers = $state<LayerView[]>([]);
  let providers = $state<ProviderView[]>([]);
  let plugins = $state<PluginView[]>([]);
  let orders = $state<Record<string, LayerItem[]>>({});
  let failure = $state<string | null>(null);
  let editing = $state<{ layer: LayerView; plugins: PluginView[] } | null>(null);

  /** The tail of the write chain, so two quick changes reach the server in order. */
  let saving: Promise<unknown> = Promise.resolve();

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
    orders = seed(layers, providers);
  }

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
    const seeded: Record<string, LayerItem[]> = {};
    for (const layer of layers) {
      seeded[layer.layer] = layerItems(layer, providers);
    }
    return seeded;
  }

  /**
   * Returns the heading of one layer, capitalised (p25b).
   *
   * @param layer The server's layer name.
   * @returns The name with its first letter raised.
   */
  function heading(layer: string): string {
    return layer.charAt(0).toUpperCase() + layer.slice(1);
  }

  /**
   * Returns the health pill of one instance.
   *
   * @param slug The instance slug.
   * @returns The pill's tone, glyph and label; "Not checked yet" when the
   *   server has not
   *   checked the instance.
   */
  function health(slug: string): { tone: PillTone; glyph: IconName; label: string } {
    const provider = providers.find((candidate) => candidate.slug === slug);
    if (provider === undefined || provider.health === null || provider.health === undefined) {
      return { tone: 'neutral', glyph: 'custom-unknown', label: 'Not checked yet' };
    }
    return provider.health.ok
      ? { tone: 'success', glyph: 'adwaita-check', label: 'Healthy' }
      : { tone: 'error', glyph: 'adwaita-error', label: 'Failed' };
  }

  /**
   * Replaces one layer's order and saves it at once.
   *
   * @param layer The layer's server name.
   * @param items The new order.
   */
  function change(layer: string, items: LayerItem[]): void {
    orders = { ...orders, [layer]: items };
    save(layer, items);
  }

  /**
   * Writes one layer's order and toasts the saved heading.
   *
   * @param layer The layer's server name.
   * @param items The order to write.
   */
  function save(layer: string, items: LayerItem[]): void {
    const name = heading(layer);
    const request = saving.then(() =>
      nativeClient.PUT('/api/v1/admin/layers/{layer}', {
        params: { path: { layer } },
        body: items.map((item) => item.id)
      })
    );
    saving = request.catch(() => undefined);
    void request.then((answer) => {
      if (answer.data === undefined) {
        toasts.push(problemMessage(answer.error, 'Could not save the layer order.'), 'error');
        return;
      }
      toasts.push(`Saved the order of ${name}.`);
    });
  }

  /**
   * Removes one instance from a layer's list.
   *
   * @param layer The layer to remove from.
   * @param slug The instance to remove.
   */
  function remove(layer: LayerView, slug: string): void {
    change(
      layer.layer,
      (orders[layer.layer] ?? []).filter((item) => item.id !== slug)
    );
  }

  /**
   * Returns the installed plugins whose instances may serve a layer.
   *
   * @param layer The layer.
   * @returns The plugins that provide it.
   */
  function candidates(layer: LayerView): PluginView[] {
    return plugins.filter((plugin) => plugin.enabled && plugin.provides.includes(layer.layer));
  }

  /**
   * Opens the instance dialog for a layer, offering the plugins that serve it.
   *
   * @param layer The layer to add an instance to.
   */
  function openAdd(layer: LayerView): void {
    editing = { layer, plugins: candidates(layer) };
  }

  /**
   * Adds the instance the dialog created to its layer and saves the layer.
   *
   * @param provider The instance.
   */
  function added(provider: ProviderView): void {
    const layer = editing?.layer;
    editing = null;
    if (layer === undefined) {
      return;
    }
    providers = [...providers, provider];
    change(layer.layer, [
      ...(orders[layer.layer] ?? []),
      { id: provider.slug, name: provider.displayName }
    ]);
  }
</script>

<svelte:head>
  <title>Layers - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load()}>Retry</Button>
{/snippet}

<PageHeader title="Layers" class="admin-header" onnavigation={shell?.openNavigation} />

<div class="content">
  {#if failure !== null}
    <StatusPage
      level={2}
      alert
      icon="adwaita-error"
      title="Could Not Load This Page"
      text="The server did not answer. Try again in a moment."
      action={retryAction}
    />
  {:else}
    <p class="lead">
      A layer tries its instances in the order they stand in; the first is the one that serves.
    </p>

    {#each layers as layer (layer.layer)}
      <section class="layer">
        <h2 class="hs-section-header__title layer-heading">{heading(layer.layer)}</h2>

        <ReorderList
          items={orders[layer.layer] ?? []}
          label="Instances of {layer.layer}"
          handles="always"
          twoLine
          onchange={(items) => change(layer.layer, items)}
        >
          {#snippet children(item)}
            {@const state = health(item.id)}
            <span class="hs-setting-row__text">
              <span>{item.name}</span>
              <span class="hs-setting-row__subtitle hs-setting-row__subtitle--mono">{item.id}</span>
            </span>
            <span class="health">
              <Pill tone={state.tone} glyph={state.glyph} label={state.label} />
            </span>
            <Button
              shape="icon"
              variant="flat"
              icon="adwaita-delete"
              label="Remove"
              onclick={() => remove(layer, item.id)}
            />
          {/snippet}

          {#snippet footer()}
            {#if (orders[layer.layer] ?? []).length === 0}
              <div class="hs-setting-row">
                <span class="hs-setting-row__text">
                  <span class="hs-setting-row__subtitle">Nothing serves this layer yet.</span>
                </span>
              </div>
            {/if}
            <ListRow
              title="Add Instance"
              button
              icon="adwaita-add"
              disabled={candidates(layer).length === 0}
              onclick={() => openAdd(layer)}
            />
          {/snippet}
        </ReorderList>
      </section>
    {/each}
  {/if}
</div>

{#if editing !== null}
  <ProviderForm
    provider={null}
    plugins={editing.plugins}
    takenSlugs={providers.map((provider) => provider.slug)}
    addLabel="Add Instance"
    onclose={() => (editing = null)}
    onsaved={added}
  />
{/if}

<style>
  /* Layout glue only: the shell already holds the page off the window edge, so
     the k25 header aligns to that margin. The class lands on the component's
     own header, hence `:global`. */
  :global(.admin-header) {
    padding-inline: 0;
  }

  /* Layout glue only: p25b puts the intro above the layers and leaves the page
     28 px at the bottom. */
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    padding-block: 0 var(--hs-space-7);
  }

  /* The muted intro line of p25b, bounded at the group width. */
  .lead {
    margin: 0;
    max-width: 760px;
    color: var(--hs-fg-muted);
  }

  /* p25b gives each layer 10 px above its heading and 8 px between the heading
     and the group. */
  .layer {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-2);
    max-width: 760px;
    margin-top: 10px;
  }

  .layer-heading {
    margin: 0;
  }

  /* p05b hides the health pills on phones; handles and bins stay. */
  @media (max-width: 720px) {
    .health {
      display: none;
    }
  }
</style>
