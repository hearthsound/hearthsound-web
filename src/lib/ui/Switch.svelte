<!--
  A switch in its row (k07-r2).

  The switch is a single control with `role="switch"` and `aria-checked`;
  Space toggles it and the visible row label names it. The row takes the focus
  tint and the label the accent colour.

  Usage:
  `<Switch label="Enable uploads" bind:checked={uploads} />`
-->
<script lang="ts">
  /** Props of a switch row. */
  interface Props {
    /** The visible label beside the switch; it also names the control. */
    label: string;
    /** Whether the switch is on, bound by the caller. */
    checked?: boolean;
    /** The disabled state. */
    disabled?: boolean;
    /** Receives the state after a change. */
    onchange?: (checked: boolean) => void;
  }

  let { label, checked = $bindable(false), disabled = false, onchange }: Props = $props();

  const id = $props.id();

  /**
   * Flips the switch and tells the caller.
   */
  function toggle(): void {
    if (disabled) {
      return;
    }
    checked = !checked;
    onchange?.(checked);
  }
</script>

<div class="hs-choice" class:hs-choice--disabled={disabled}>
  <button
    class="hs-switch"
    type="button"
    role="switch"
    aria-checked={checked}
    aria-labelledby="{id}-label"
    {disabled}
    onclick={toggle}
  ></button>
  <span id="{id}-label">{label}</span>
</div>
