<!--
  A count badge (k10).

  The count is visible and tabular; the accessible name adds "items" as
  visually hidden text, so "12" is read as "12 items".

  Usage:
  `<CountBadge count={albums.length} />`
-->
<script lang="ts">
  /** Props of a count badge. */
  interface Props {
    /** The number shown. */
    count: number;
  }

  let { count }: Props = $props();
</script>

<span class="hs-count-badge">
  {count}
  <span class="hs-visually-hidden">&nbsp;items</span>
</span>
