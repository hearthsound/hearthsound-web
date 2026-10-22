<!--
  The k09b row placeholders a list holds while its next page loads.

  The rows use the same grid as the loaded k12 rows, so the list does not move
  when the answer arrives. They are hidden from assistive technology: the page
  already names its busy state.
-->
<script lang="ts">
  import Skeleton from '#lib/ui/Skeleton.svelte';

  /** Props of the placeholder rows. */
  interface Props {
    /** How many rows to draw. */
    count: number;
  }

  let { count }: Props = $props();
</script>

{#each Array.from({ length: count }, (_, index) => index) as row (row)}
  <li class="hs-track-row" aria-hidden="true">
    <span class="hs-track-row__lead">
      <Skeleton width="40px" height="40px" radius="art-small" />
    </span>
    <span class="hs-track-row__text">
      <Skeleton width="60%" height="12px" />
      <Skeleton width="35%" height="10px" />
    </span>
    <span class="hs-track-row__album"><Skeleton width="50%" height="10px" /></span>
    <span class="hs-track-row__status"></span>
    <span></span>
    <span class="hs-track-row__duration"><Skeleton width="30px" height="10px" /></span>
  </li>
{/each}
