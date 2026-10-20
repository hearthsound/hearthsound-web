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

<p class="hs-caption label">{uischema.text}</p>

<style>
  .label {
    margin: 0;
    color: var(--hs-fg-muted);
  }
</style>
