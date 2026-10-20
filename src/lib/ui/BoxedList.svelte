<!--
  A boxed group of settings or admin rows (k11-r1).

  The group draws the deeper grey surface and the rows inside it (ListRow)
  draw their own separators. The group is a fieldset named by `label` or
  `labelledby`, so a section heading can name it instead.

  Usage: `<BoxedList label="Playback"><ListRow ... /></BoxedList>`
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Props of the group. */
  interface Props {
    /** The accessible name of the group. */
    label?: string;
    /** The id of the heading that names the group; takes precedence over `label`. */
    labelledby?: string;
    /** The rows. */
    children: Snippet;
  }

  let { label, labelledby, children }: Props = $props();
</script>

<fieldset
  class="hs-settings-group group"
  aria-label={labelledby === undefined ? label : undefined}
  aria-labelledby={labelledby}
>
  {@render children()}
</fieldset>

<style>
  .group {
    margin: 0;
    padding: 0;
    border: 0;
    min-inline-size: 0;
  }
</style>
