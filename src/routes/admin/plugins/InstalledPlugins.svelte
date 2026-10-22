<!--
  The Installed group of the plugins page (p24).

  Every row shows the plugin's name with its lifecycle pill, its id, version and
  source, and the commands that switch it off, review a staged upgrade or
  remove it. The group keeps the state pill beside the name and pins the row
  menu to the top right on phones (p24-r1).
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import type { PluginView } from '#lib/admin/plugins';
  import { pluginStateLabel, sourceLabel } from '#lib/admin/plugins';
  import Button from '#lib/ui/Button.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import type { PillTone } from '#lib/ui/Pill.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';

  /** Props of the installed group. */
  interface Props {
    /** The installed plugins, in the order the server lists them. */
    plugins: PluginView[];
    /** Whether a page is being read right now. */
    loading: boolean;
    /** Switches one plugin off or on again. */
    ontoggle: (plugin: PluginView) => void;
    /** Opens the Review Upgrade dialog for one plugin. */
    onreview: (plugin: PluginView) => void;
    /** Asks to remove one plugin. */
    onremove: (plugin: PluginView) => void;
  }

  let { plugins, loading, ontoggle, onreview, onremove }: Props = $props();

  /**
   * The pill one lifecycle state is drawn with.
   *
   * @param state The state the server reported.
   * @returns The tone and glyph; the neutral unknown pill for a state this
   *   client does not know.
   */
  function statePill(state: string): { tone: PillTone; glyph: IconName } {
    switch (state) {
      case 'enabled':
        return { tone: 'success', glyph: 'adwaita-check' };
      case 'disabled':
        return { tone: 'neutral', glyph: 'adwaita-remove' };
      case 'upgrade-pending-approval':
        return { tone: 'warning', glyph: 'adwaita-warning' };
      default:
        return { tone: 'neutral', glyph: 'custom-unknown' };
    }
  }
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

<h2 class="hs-section-header__title group-heading">Installed</h2>
<ul class="hs-settings-group group" aria-label="Installed">
  {#each plugins as plugin (plugin.id)}
    {@const pill = statePill(plugin.state)}
    <li class="hs-setting-row hs-setting-row--two-line plugin-row">
      <span class="hs-setting-row__text">
        <span class="name">
          {plugin.name}
          <Pill tone={pill.tone} glyph={pill.glyph} label={pluginStateLabel(plugin.state)} />
        </span>
        <span class="hs-setting-row__subtitle">
          {plugin.id} - version {plugin.version} - from {sourceLabel(plugin.source)}
        </span>
      </span>
      {#if plugin.upgrade !== null && plugin.upgrade !== undefined}
        <Button class="review" onclick={() => onreview(plugin)}>Review Upgrade</Button>
      {/if}
      <Menu label="More Actions" align="end">
        {#if plugin.enabled}
          <MenuItem label="Disable" icon="adwaita-remove" onselect={() => ontoggle(plugin)} />
        {:else}
          <MenuItem label="Enable" icon="adwaita-check" onselect={() => ontoggle(plugin)} />
        {/if}
        <MenuItem
          label="Remove"
          icon="adwaita-delete"
          destructive
          onselect={() => onremove(plugin)}
        />
      </Menu>
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

  /* The name line of an installed row, with the state pill beside it (p24). */
  .name {
    display: flex;
    flex-wrap: wrap;
    gap: var(--hs-space-2);
    align-items: center;
  }

  /* p24-r1 pins the row menu to the top right on phones and keeps the row's
     text off it; the Review Upgrade button drops to its own line there. */
  @media (max-width: 720px) {
    .plugin-row {
      position: relative;
      flex-wrap: wrap;
      padding-right: 48px;
    }

    .plugin-row > .hs-setting-row__text {
      flex: 1 1 100%;
    }

    .plugin-row > :global(.menu-anchor) {
      position: absolute;
      top: 8px;
      right: 6px;
    }

    .plugin-row > :global(.hs-button.review) {
      margin-top: 4px;
    }
  }
</style>
