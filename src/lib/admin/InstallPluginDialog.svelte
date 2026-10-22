<!--
  The install confirmation.

  The plugins page shows it before installing a plugin from an index, so the
  administrator sees what the plugin will be able to do before consenting.
  Ticking Don't ask again is handed back with the answer; the page stores the
  setting that skips the question next time. The page decides when to show the
  dialog, and the setup wizard does not use it.
-->
<script lang="ts">
  import Button from '#lib/ui/Button.svelte';
  import Checkbox from '#lib/ui/Checkbox.svelte';
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
    /** The permissions the offered version reported. */
    permissions: PermissionView[];
    /** Closes the confirmation without installing. */
    onclose: () => void;
    /** Installs the plugin with the administrator's answer; the caller keeps the button busy until it answers. */
    oninstall: (dontAskAgain: boolean) => void;
    /** Whether the install is running. */
    busy?: boolean;
  }

  let { name, id, version, permissions, onclose, oninstall, busy = false }: Props = $props();

  /** Whether the administrator asked to skip the question next time. */
  let dontAskAgain = $state(false);
</script>

{#snippet footer()}
  <Button onclick={onclose}>Cancel</Button>
  <Button variant="suggested" {busy} onclick={() => oninstall(dontAskAgain)}>Install</Button>
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
  <Checkbox label="Don't ask again" bind:checked={dontAskAgain} />
</Dialog>
