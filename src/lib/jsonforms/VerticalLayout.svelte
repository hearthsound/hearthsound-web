<!--
  A column of form elements.
-->
<script lang="ts">
  import type { UISchemaElement, VerticalLayout } from '@jsonforms/core';
  import type { Snippet } from 'svelte';

  /** Props of the layout. */
  interface Props {
    /** The layout element to draw. */
    uischema: VerticalLayout;
    /** Draws one child element. */
    node: Snippet<[UISchemaElement]>;
  }

  let { uischema, node }: Props = $props();
</script>

<div class="vertical-layout">
  {#each uischema.elements as child, index (index)}
    {@render node(child)}
  {/each}
</div>

<style>
  .vertical-layout {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }
</style>
