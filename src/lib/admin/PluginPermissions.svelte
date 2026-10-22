<!--
  The permissions one plugin asks for, with the risk each grant carries.

  The summary is the `<Name> (<id>) version <v>, from <source>.` line, followed
  by the requested permissions or a line saying the plugin asks for nothing. It
  is shown while installing and from an installed plugin's Permissions menu
  item.
-->
<script lang="ts">
  import PermissionList from './PermissionList.svelte';
  import type { PluginView } from './plugins';
  import { sourceLabel } from './plugins';

  /** Props of the list. */
  interface Props {
    /** The plugin whose permissions are shown. */
    plugin: PluginView;
  }

  let { plugin }: Props = $props();
</script>

<div class="permissions">
  <p class="hs-setting-row__subtitle">
    {plugin.name} ({plugin.id}) version {plugin.version}, from {sourceLabel(plugin.source)}.
  </p>

  {#if plugin.requestedPermissions.length === 0}
    <p class="hs-setting-row__subtitle">It asks for no permissions beyond running.</p>
  {:else}
    <PermissionList permissions={plugin.requestedPermissions} />
  {/if}
</div>

<style>
  .permissions {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-2);
  }

  .permissions > p {
    margin: 0;
  }
</style>
