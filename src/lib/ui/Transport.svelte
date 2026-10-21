<!--
  The transport row (k02).

  A plain inline-flex wrapper for the flat round previous/next buttons, the
  play disc and the shuffle and repeat toggles. `large` widens the gaps and
  sizes the flat round buttons for the now-playing view, whose own class
  spreads the controls edge to edge (p20-r4).

  Usage:
  `<Transport label="Playing"><PlayButton state="pause" />...</Transport>`
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Props of the transport row. */
  interface Props {
    /** The 14 px-gap now-playing layout instead of the player bar's 6 px. */
    large?: boolean;
    /** The accessible name, when the transport is announced as a group. */
    label?: string;
    /** Extra classes, such as the now-playing column's own transport part. */
    class?: string;
    /** The controls. */
    children?: Snippet;
  }

  let { large = false, label, class: extra = '', children }: Props = $props();
</script>

<div
  class="hs-transport {extra}"
  class:hs-transport--large={large}
  aria-label={label}
  role={label ? 'group' : undefined}
>
  {@render children?.()}
</div>
