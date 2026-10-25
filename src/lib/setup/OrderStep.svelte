<!--
  The order step: which instance serves each layer first.

  Every layer that holds an instance is listed with it, the instances this run
  configured joining the layers their plugin provides in the order they were
  created, and a later visit to the step absorbing the instances and plugins
  configured in the meantime. Handles are always shown (p05b); dragging or the
  k30 keyboard moves an entry, the bin removes one and the group's last row adds
  an instance. The first entry is the one that serves, and Continue writes the
  order of every layer shown, trying the ones the server refused again.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { IconName } from '@hearthsound/design/icons';

  import ProviderForm from '#lib/admin/ProviderForm.svelte';
  import { listLayers, saveLayerOrder } from '#lib/admin/api/layers';
  import { listPlugins } from '#lib/admin/api/plugins';
  import { listProviders } from '#lib/admin/api/providers';
  import type { LayerItem, LayerView } from '#lib/admin/layers';
  import type { PluginView } from '#lib/admin/plugins';
  import type { ProviderView } from '#lib/admin/providers';
  import type { OrderState } from '#lib/setup/order-state.svelte';

  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import ListRow from '#lib/ui/ListRow.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import type { PillTone } from '#lib/ui/Pill.svelte';
  import ReorderList from '#lib/ui/ReorderList.svelte';
  import SetupFooter from './SetupFooter.svelte';

  /** Props of the step. */
  interface Props {
    /** The order of this wizard run, which outlives the step. */
    order: OrderState;
    /** The plugin ids the administrator checked. */
    selected: string[];
    /** Moves on to the next step. */
    oncontinue: () => void;
    /** Moves back to the previous step. */
    onback?: () => void;
  }

  let { order, selected, oncontinue, onback }: Props = $props();

  let editing = $state<{ layer: LayerView; plugins: PluginView[] } | null>(null);
  /** What the server answered when the layers could not be read. */
  let loadFailure = $state<string | null>(null);
  /** The layers whose last save the server refused, by the layer's name. */
  let failures = $state<Record<string, string>>({});
  /** Busy until the layers are loaded and their first saves are queued. */
  let busy = $state(true);

  onMount(async () => {
    const [ordered, instances, installed] = await Promise.all([
      listLayers(),
      listProviders(),
      listPlugins()
    ]);
    if (!ordered.ok) {
      loadFailure = ordered.message;
      busy = false;
      return;
    }
    // The instances this run configured join their layers at once, the same
    // way every later change is saved (order-save). The state seeds them on the
    // first visit only; a later visit absorbs what it configured in the
    // meantime, and a deletion made on an earlier visit survives.
    const touched = order.seeded
      ? order.absorb(
          ordered.value,
          instances.ok ? instances.value : [],
          installed.ok ? installed.value : [],
          selected
        )
      : order.seed(
          ordered.value,
          instances.ok ? instances.value : [],
          installed.ok ? installed.value : [],
          selected
        );
    for (const layer of touched) {
      void save(layer.layer);
    }
    busy = false;
  });

  /**
   * Saves one layer's order as it stands; a layer the server refuses keeps its
   * failure until a later save of that layer succeeds.
   *
   * @param layer The layer's server name.
   * @returns Whether the server took the order.
   */
  async function save(layer: string): Promise<boolean> {
    const body = (order.orders[layer] ?? []).map((item) => item.id);
    const request = order.saving.then(() => saveLayerOrder(layer, body));
    order.saving = request.catch(() => undefined);
    const result = await request;
    const next = { ...failures };
    if (result.ok) {
      delete next[layer];
    } else {
      next[layer] = result.message;
    }
    failures = next;
    return result.ok;
  }

  /**
   * Moves on once every save in flight has landed and every refused layer was
   * tried again; a layer that is still refused keeps the step.
   */
  async function proceed(): Promise<void> {
    busy = true;
    await order.saving;
    for (const layer of Object.keys(failures)) {
      await save(layer);
    }
    busy = false;
    if (Object.keys(failures).length === 0) {
      oncontinue();
    }
  }

  /**
   * Replaces one layer's order and saves it at once.
   *
   * @param layer The layer's server name.
   * @param items The new order.
   */
  function change(layer: string, items: LayerItem[]): void {
    order.orders = { ...order.orders, [layer]: items };
    void save(layer);
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
   * @returns The pill's tone, glyph and label; Unknown when the server has not
   *   checked the instance.
   */
  function health(slug: string): { tone: PillTone; glyph: IconName; label: string } {
    const provider = order.providers.find((candidate) => candidate.slug === slug);
    if (provider?.health === undefined || provider.health === null) {
      return { tone: 'neutral', glyph: 'custom-unknown', label: 'Unknown' };
    }
    return provider.health.ok
      ? { tone: 'success', glyph: 'adwaita-check', label: 'Healthy' }
      : { tone: 'error', glyph: 'adwaita-error', label: 'Failed' };
  }

  /**
   * Removes one instance from a layer's list, and remembers the removal so a
   * later visit to the step does not add it back.
   *
   * @param layer The layer to remove from.
   * @param slug The instance to remove.
   */
  function remove(layer: LayerView, slug: string): void {
    order.remove(layer.layer, slug);
    change(
      layer.layer,
      (order.orders[layer.layer] ?? []).filter((item) => item.id !== slug)
    );
  }

  /**
   * Returns the installed plugins whose instances may serve a layer.
   *
   * @param layer The layer.
   * @returns The plugins that provide it.
   */
  function candidates(layer: LayerView): PluginView[] {
    return order.plugins.filter((plugin) => plugin.provides.includes(layer.layer));
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
   * Appends the instance the dialog created to its layer.
   *
   * @param provider The instance.
   */
  function added(provider: ProviderView): void {
    const layer = editing?.layer;
    editing = null;
    if (layer === undefined) {
      return;
    }
    order.providers = [...order.providers, provider];
    change(layer.layer, [
      ...(order.orders[layer.layer] ?? []),
      { id: provider.slug, name: provider.displayName }
    ]);
  }
</script>

<section class="hs-form">
  <div class="hs-setup">
    <h2 class="hs-title-3 step-title">Order</h2>
    <p class="step-lead">
      A layer tries its instances in the order they stand in, and the first is the one that serves.
      Drag an entry to move it, remove one you do not want to serve, or add another instance.
    </p>

    {#if loadFailure !== null}
      <Banner level="error" text={loadFailure} />
    {/if}

    {#each Object.entries(failures) as [layer, message] (layer)}
      <Banner level="error" text="{heading(layer)}: {message}" />
    {/each}

    {#if order.layers.length > 0}
      {#each order.layers as layer (layer.layer)}
        <section class="layer">
          <h3 class="hs-title-4">{heading(layer.layer)}</h3>

          <ReorderList
            items={order.orders[layer.layer] ?? []}
            label="Instances of {layer.layer}"
            handles="always"
            twoLine
            onchange={(items) => change(layer.layer, items)}
          >
            {#snippet children(item)}
              {@const state = health(item.id)}
              <span class="hs-setting-row__text">
                <span>{item.name}</span>
                <span class="hs-setting-row__subtitle hs-setting-row__subtitle--mono"
                  >{item.id}</span
                >
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
              {#if (order.orders[layer.layer] ?? []).length === 0}
                <div class="hs-setting-row">
                  <span class="hs-setting-row__text"
                    ><span class="hs-setting-row__subtitle">Nothing serves this layer yet.</span
                    ></span
                  >
                </div>
              {/if}
              <!-- The add row is always there; it is disabled when no installed plugin
                   can serve the layer (order-layers-2). -->
              <ListRow
                title="Add instance"
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

    <SetupFooter {onback}>
      <Button variant="suggested" {busy} onclick={proceed}>Continue</Button>
    </SetupFooter>
  </div>
</section>

{#if editing !== null}
  <ProviderForm
    provider={null}
    plugins={editing.plugins}
    takenSlugs={order.providers.map((provider) => provider.slug)}
    onclose={() => (editing = null)}
    onsaved={added}
  />
{/if}

<style>
  .step-title,
  .step-lead {
    margin: 0;
  }

  .layer {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
  }

  .layer > .hs-title-4 {
    margin: 0;
  }

  .health {
    display: inline-flex;
  }

  /* p05b: the health pills leave the row at 720 px and below; handle and bin stay. */
  @media (max-width: 720px) {
    .health {
      display: none;
    }
  }
</style>
