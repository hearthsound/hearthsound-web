<!--
  A progress bar (k09).

  A determinate bar fills by `value`; without one the bar is indeterminate and
  omits `aria-valuenow`. It is never focusable and takes its name from
  `label`, e.g. "Downloading".

  Usage:
  `<ProgressBar label="Downloading" value={42} />`
  `<ProgressBar label="Downloading" />`
-->
<script lang="ts">
  /** Props of a progress bar. */
  interface Props {
    /** The accessible name. */
    label: string;
    /** The current value; omit for the indeterminate bar. */
    value?: number;
    /** The value the bar reaches; 100 when not given. */
    max?: number;
  }

  let { label, value, max = 100 }: Props = $props();

  const indeterminate = $derived(value === undefined);
  const shown = $derived(
    value === undefined ? 0 : Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100))
  );
</script>

<div
  class="hs-progress"
  class:hs-progress--indeterminate={indeterminate}
  role="progressbar"
  aria-label={label}
  aria-valuenow={indeterminate ? undefined : value}
  aria-valuemin="0"
  aria-valuemax={max}
>
  <span class="hs-progress__fill" style:width="{shown}%"></span>
</div>
