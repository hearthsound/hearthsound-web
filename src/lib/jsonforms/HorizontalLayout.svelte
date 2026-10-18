<!--
  A row of form elements.
-->
<script lang="ts">
  import type { HorizontalLayout, UISchemaElement } from '@jsonforms/core';
  import type { Snippet } from 'svelte';

  /** Props of the layout. */
  interface Props {
    /** The layout element to draw. */
    uischema: HorizontalLayout;
    /** Draws one child element. */
    node: Snippet<[UISchemaElement]>;
  }

  let { uischema, node }: Props = $props();
</script>

<div class="horizontal-layout">
  {#each uischema.elements as child, index (index)}
    {@render node(child)}
  {/each}
</div>

<style>
  .horizontal-layout {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: flex-start;
  }
</style>
