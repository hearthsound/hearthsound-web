<!--
  A titled group of form elements.
-->
<script lang="ts">
  import type { GroupLayout, UISchemaElement } from '@jsonforms/core';
  import type { Snippet } from 'svelte';

  /** Props of the layout. */
  interface Props {
    /** The layout element to draw. */
    uischema: GroupLayout;
    /** Draws one child element. */
    node: Snippet<[UISchemaElement]>;
  }

  let { uischema, node }: Props = $props();

  const title = $derived(typeof uischema.label === 'string' ? uischema.label : '');
</script>

<fieldset class="group">
  <legend class="group-title">{title}</legend>
  {#each uischema.elements as child, index (index)}
    {@render node(child)}
  {/each}
</fieldset>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    margin: 0;
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .group-title {
    padding: 0 var(--space-1);
    color: var(--color-fg-muted);
    font-weight: 600;
  }
</style>
