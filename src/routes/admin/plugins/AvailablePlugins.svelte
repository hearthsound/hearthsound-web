<!--
  The Available group of the plugins page (p24).

  Every row shows what an index offers - the name, the id, version, the layers
  it provides and its description - with the one Install command. An entry the
  index marks unavailable shows why and cannot be installed. The group only
  lists what this server does not already host at the same version.
-->
<script lang="ts">
  import type { AvailablePluginView } from '#lib/admin/plugins';
  import Button from '#lib/ui/Button.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';

  /** Props of the available group. */
  interface Props {
    /** The installable entries, in the order the indexes listed them. */
    plugins: AvailablePluginView[];
    /** Whether a page is being read right now. */
    loading: boolean;
    /** The id of the plugin whose install is running, or `null`. */
    installing: string | null;
    /** Installs one plugin and enables it. */
    oninstall: (plugin: AvailablePluginView) => void;
  }

  let { plugins, loading, installing, oninstall }: Props = $props();
</script>

{#snippet loadingRows()}
  {#each [0, 1, 2] as row (row)}
    <li class="hs-setting-row" aria-hidden="true">
      <span class="hs-setting-row__text">
        <Skeleton width="35%" height="12px" />
        <Skeleton width="65%" height="10px" />
      </span>
    </li>
  {/each}
{/snippet}

<h2 class="hs-section-header__title group-heading">Available</h2>
<ul class="hs-settings-group group" aria-label="Available">
  {#each plugins as plugin (plugin.id)}
    {@const unavailable = plugin.unavailable ?? null}
    <li class="hs-setting-row hs-setting-row--two-line plugin-row">
      <span class="hs-setting-row__text">
        <span>{plugin.name}</span>
        <span class="hs-setting-row__subtitle">
          {plugin.id} - version {plugin.version ?? '-'} - provides {plugin.provides.join(', ')}
        </span>
        <span class="hs-setting-row__subtitle">{plugin.description}</span>
        {#if unavailable !== null}
          <span class="hs-setting-row__subtitle">{unavailable.detail}</span>
        {/if}
      </span>
      <Button
        disabled={unavailable !== null}
        busy={installing === plugin.id}
        onclick={() => oninstall(plugin)}
      >
        Install
      </Button>
    </li>
  {/each}

  {#if loading && plugins.length === 0}
    {@render loadingRows()}
  {:else if plugins.length === 0}
    <li class="hs-setting-row">
      <span class="hs-setting-row__text">
        <span class="hs-setting-row__subtitle">Nothing here yet.</span>
      </span>
    </li>
  {/if}
</ul>

<style>
  /* Layout glue only: the boards' group heading is 19/750 with a 10 px top
     margin and a -6 px bottom one against the group. */
  .group-heading {
    margin: 10px 0 -6px;
  }

  /* Layout glue only: p24 caps every group at 760 px. */
  .group {
    max-width: 760px;
  }

  /* p24-r1 keeps the row's text clear of the action on phones. */
  @media (max-width: 720px) {
    .plugin-row {
      position: relative;
      flex-wrap: wrap;
      padding-right: 48px;
    }

    .plugin-row > .hs-setting-row__text {
      flex: 1 1 100%;
    }
  }
</style>
