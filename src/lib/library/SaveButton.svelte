<!--
  The library membership control.

  One button saves an album or an artist to the signed-in account's personal
  library or removes it again. It starts from what the server reported and
  follows the write it made, so the words change the moment the write succeeds.
-->
<script lang="ts">
  import { membership } from '#lib/library/membership.svelte';
  import type { MembershipEntity } from '#lib/library/membership.svelte';

  /** Props of a membership control. */
  interface Props {
    /** The entity to save or remove. */
    entity: MembershipEntity;
  }

  let { entity }: Props = $props();

  const inLibrary = $derived(membership.isInLibrary(entity));
</script>

<button class="save" type="button" onclick={() => membership.toggle(entity)}>
  {inLibrary ? 'Remove from library' : 'Save to library'}
</button>

<style>
  .save {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }
</style>
