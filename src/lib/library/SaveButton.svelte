<!--
  The library membership command (p15, p16).

  One song-menu item saves an album or an artist to the signed-in account's
  personal library or removes it again. It starts from what the server reported
  and follows the write it made, so the label changes the moment the write
  succeeds.
-->
<script lang="ts">
  import { membership } from '#lib/library/membership.svelte';
  import type { MembershipEntity } from '#lib/library/membership.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';

  /** Props of a membership command. */
  interface Props {
    /** The entity to save or remove. */
    entity: MembershipEntity;
  }

  let { entity }: Props = $props();

  const inLibrary = $derived(membership.isInLibrary(entity));
</script>

<MenuItem
  label={inLibrary ? 'Remove from Library' : 'Save to Library'}
  icon={inLibrary ? 'adwaita-check' : 'adwaita-add'}
  onselect={() => void membership.toggle(entity)}
/>
