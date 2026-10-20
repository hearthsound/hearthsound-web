<!--
  The Install confirmation (p24-r3), built but switched off.

  Installing is approval, so the confirmation lists what the plugin will be
  able to do before the administrator commits. Until the core plugin-approval
  removal reports permissions for uninstalled plugins, Install and Install
  File install and enable directly and this dialog is not rendered
  (plugin-approval-interim, plugin-approval-D). Switching it on is the core
  change's follow-up, not a page decision.
-->
<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';

  import PermissionList from './PermissionList.svelte';
  import type { PermissionView } from './plugins';

  /** Props of the confirmation. */
  interface Props {
    /** The plugin's display name. */
    name: string;
    /** The plugin id from its manifest. */
    id: string;
    /** The version the index offers. */
    version: string;
    /** The permissions the archive or index reported. */
    permissions: PermissionView[];
    /** Closes the confirmation without installing. */
    onclose: () => void;
    /** Installs the plugin; the caller keeps the button busy until it answers. */
    oninstall: () => void;
    /** Whether the install is running. */
    busy?: boolean;
  }

  let { name, id, version, permissions, onclose, oninstall, busy = false }: Props = $props();
</script>

{#snippet footer()}
  <Button onclick={onclose}>Cancel</Button>
  <Button variant="suggested" {busy} onclick={oninstall}>Install</Button>
{/snippet}

<Dialog title="Install {name}?" {onclose} {footer}>
  {#if permissions.length === 0}
    <p>{name} ({id}) version {version}. It asks for no permissions beyond running.</p>
  {:else}
    <p>{name} ({id}) version {version}. It will be able to:</p>
    <div class="hs-settings-group">
      <PermissionList {permissions} />
    </div>
  {/if}
</Dialog>
