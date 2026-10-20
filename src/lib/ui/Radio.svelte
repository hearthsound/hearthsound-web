<!--
  A radio row (k06).

  Radios that share `name` form one native group: one tab stop on the chosen
  radio, arrow keys move and choose, and Space chooses when none is. Bind the
  shared `group` state of the whole group to each radio; a `role="radiogroup"`
  named by its legend or heading wraps them.

  Usage:
  `<Radio name="quality" value="original" label="Original" bind:group={quality} />`
-->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  /** Props of a radio. */
  interface Props extends Omit<HTMLInputAttributes, 'type' | 'checked' | 'children' | 'onchange'> {
    /** The group's name; shared by every radio of the group. */
    name: string;
    /** This radio's value. */
    value: string;
    /** The chosen value of the whole group, bound by the caller. */
    group?: string;
    /** The visible label beside the box; it also names the control. */
    label: string;
    /** The disabled state. */
    disabled?: boolean;
  }

  let { name, value, group = $bindable(), label, disabled = false, ...rest }: Props = $props();
</script>

<label class="hs-choice hs-choice--radio" class:hs-choice--disabled={disabled}>
  <input {...rest} class="hs-choice__input" type="radio" {name} {value} bind:group {disabled} />
  <span class="hs-choice__box" class:hs-choice__box--on={group === value}>
    <span class="hs-choice__dot"></span>
  </span>
  {label}
</label>
