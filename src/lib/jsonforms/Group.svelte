<!--
  A titled group of form elements.

  The title is a heading over its fields, spaced from them the way the form's
  own sections space an h3. The group draws no panel of its own, because a
  plugin's configuration may already sit inside a dialog section.
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
  <div class="fields">
    {#each uischema.elements as child, index (index)}
      {@render node(child)}
    {/each}
  </div>
</fieldset>

<style>
  .group {
    margin: 0;
    padding: 0;
    border: 0;
    min-inline-size: 0;
  }

  .group > legend {
    padding: 0;
  }

  /* The h3 of a form section sits 16 px above its content; a legend is not a
     flex item, so the fields keep that gap themselves. */
  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-5);
    padding-top: var(--hs-space-4);
  }
</style>
