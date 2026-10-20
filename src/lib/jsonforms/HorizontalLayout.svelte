<!--
  A row of form elements that wraps when the dialog narrows.
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

<div class="horizontal">
  {#each uischema.elements as child, index (index)}
    {@render node(child)}
  {/each}
</div>

<style>
  .horizontal {
    display: flex;
    flex-wrap: wrap;
    gap: var(--hs-space-5);
    align-items: flex-start;
  }

  .horizontal > :global(*) {
    flex: 1 1 45%;
    min-width: 0;
  }
</style>
