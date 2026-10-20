<!--
  A titled group of form elements.

  The title is a heading over its fields; the group draws no panel of its own,
  because a plugin's configuration may already sit inside a dialog section.
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
  <legend class="hs-heading">{title}</legend>
  {#each uischema.elements as child, index (index)}
    {@render node(child)}
  {/each}
</fieldset>

<style>
  .group {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-5);
    margin: 0;
    padding: 0;
    border: 0;
    min-inline-size: 0;
  }

  .group > legend {
    padding: 0;
  }
</style>
