<!--
  A line of text between the form's fields.
-->
<script lang="ts">
  import type { LabelElement } from '@jsonforms/core';

  /** Props of the label. */
  interface Props {
    /** The label element to draw. */
    uischema: LabelElement;
  }

  let { uischema }: Props = $props();
</script>

<p class="label-element">{uischema.text}</p>

<style>
  .label-element {
    margin: 0;
    color: var(--color-fg-muted);
  }
</style>
