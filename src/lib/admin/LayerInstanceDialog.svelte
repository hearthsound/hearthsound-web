<!--
  The instances of a layer, offered before a new one is configured (k19, p05-r1).

  An instance created under Admin > Providers can serve a layer without being
  configured again, so this dialog lists the configured instances whose plugin
  provides the layer and which the layer does not hold yet, above the row that
  opens the create form. Choosing one assigns it; with nothing to offer the
  dialog says so and keeps the create row.

  Usage:
  `<LayerInstanceDialog layer={picking} candidates={layerCandidates(picking, providers, plugins)}
     onclose={close} onassign={(slug) => assign(picking, slug)} oncreate={() => create(picking)} />`
-->
<script lang="ts">
  import { layerHeading } from './layers';
  import type { LayerView } from './layers';
  import type { ProviderView } from './providers';

  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import ListRow from '#lib/ui/ListRow.svelte';

  /** Props of the dialog. */
  interface Props {
    /** The layer the instance is added to. */
    layer: LayerView;
    /** The configured instances that could serve the layer but are not in it. */
    candidates: ProviderView[];
    /** Closes the dialog. */
    onclose: () => void;
    /** Adds the instance with this slug to the layer. */
    onassign: (slug: string) => void;
    /** Opens the form that configures a new instance. */
    oncreate: () => void;
  }

  let { layer, candidates, onclose, onassign, oncreate }: Props = $props();
</script>

{#snippet footer()}
  <Button onclick={onclose}>Cancel</Button>
{/snippet}

<Dialog title={`Add instance to ${layerHeading(layer.layer)}`} {onclose} {footer}>
  <div class="hs-settings-group">
    {#if candidates.length > 0}
      {#each candidates as provider (provider.slug)}
        <ListRow
          title={provider.displayName}
          subtitle={provider.slug}
          icon="adwaita-plugin"
          onclick={() => onassign(provider.slug)}
        />
      {/each}
      <div class="hs-setting-row">
        <span class="hs-setting-row__text">
          <span class="hs-setting-row__subtitle">Create another instance</span>
        </span>
      </div>
    {:else}
      <div class="hs-setting-row">
        <span class="hs-setting-row__text">
          <span class="hs-setting-row__subtitle">
            No configured instance serves this layer yet.
          </span>
        </span>
      </div>
    {/if}

    <ListRow title="Create new instance" icon="adwaita-add" button onclick={oncreate} />
  </div>
</Dialog>
