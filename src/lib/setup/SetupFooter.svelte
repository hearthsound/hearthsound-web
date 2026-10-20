<!--
  The footer of one setup step (l12-r1).

  Back sits at the left and the step's suggested action at the right; phones
  stack them full width with the action on top. Step 1 passes no `onback`, so
  the forward action keeps the right edge alone.

  Usage:
  ```
  <SetupFooter {onback}>
    <Button variant="suggested" onclick={next}>Continue</Button>
  </SetupFooter>
  ```
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import Button from '#lib/ui/Button.svelte';

  /** Props of the footer. */
  interface Props {
    /** Moves to the previous step; omitted on the first step. */
    onback?: () => void;
    /** The step's forward action, or actions. */
    children: Snippet;
  }

  let { onback, children }: Props = $props();
</script>

<div class="hs-setup__actions">
  {#if onback === undefined}
    <span></span>
  {:else}
    <Button onclick={onback}>Back</Button>
  {/if}
  {@render children()}
</div>
