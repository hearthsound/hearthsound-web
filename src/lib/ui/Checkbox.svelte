<!--
  A checkbox row (k06): the whole row is the target and the box is its face.

  Mixed uses `aria-checked="mixed"` and the remove glyph in the box; the
  caller clears `mixed` when the next change is reported.

  Usage:
  `<Checkbox label="Watch for changes" bind:checked={watch} />`
-->
<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';

  import Icon from './Icon.svelte';

  /** Props of a checkbox. */
  interface Props extends Omit<HTMLInputAttributes, 'type' | 'checked' | 'children' | 'onchange'> {
    /** The visible label beside the box; it also names the control. */
    label: string;
    /** Whether the box is checked, bound by the caller. */
    checked?: boolean;
    /** Whether the box shows the mixed state. */
    mixed?: boolean;
    /** The disabled state. */
    disabled?: boolean;
    /** Receives the state after a change. */
    onchange?: (checked: boolean) => void;
  }

  let {
    label,
    checked = $bindable(false),
    mixed = false,
    disabled = false,
    onchange,
    ...rest
  }: Props = $props();

  let input: HTMLInputElement | undefined = $state();

  $effect(() => {
    if (input !== undefined) {
      input.indeterminate = mixed;
    }
  });

  /**
   * Tells the caller the state the box moved to.
   *
   * @param event The change event.
   */
  function handleChange(event: Event): void {
    onchange?.((event.currentTarget as HTMLInputElement).checked);
  }
</script>

<label class="hs-choice" class:hs-choice--disabled={disabled}>
  <input
    {...rest}
    bind:this={input}
    class="hs-choice__input"
    type="checkbox"
    bind:checked
    {disabled}
    aria-checked={mixed ? 'mixed' : undefined}
    onchange={handleChange}
  />
  <span class="hs-choice__box" class:hs-choice__box--on={checked || mixed}>
    <Icon class="hs-choice__check" name={mixed ? 'adwaita-remove' : 'adwaita-check'} />
  </span>
  {label}
</label>
