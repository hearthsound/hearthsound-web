<!--
  A spinner (k09).

  The ring is announced as a status with the visually hidden text "Loading".
  Inside a busy button the button draws its own spinner and keeps the busy
  state instead.

  Usage:
  `<Spinner />` or `<Spinner size={48} />`
-->
<script lang="ts">
  /** The three approved sizes. */
  export type SpinnerSize = 16 | 24 | 48;

  /** Props of a spinner. */
  interface Props {
    /** The ring size in pixels; 16 when not given. */
    size?: SpinnerSize;
  }

  let { size = 16 }: Props = $props();

  const className = $derived(
    ['hs-spinner', size === 24 ? 'hs-spinner--24' : '', size === 48 ? 'hs-spinner--48' : '']
      .filter(Boolean)
      .join(' ')
  );
</script>

<span class={className} role="status">
  <span class="hs-visually-hidden">Loading</span>
</span>
