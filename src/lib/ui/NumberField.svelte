<!--
  Number entry with minus and plus at the end (k04).

  The field is a spinbutton: Up and Down step by one, Page Up and Page Down by
  ten, Home and End jump to the limits, and typing digits replaces the value.
  The 28 px step buttons are not tab stops; at a limit the matching step is
  disabled at 40%. The visible unit is repeated in `aria-valuetext`.

  Usage:
  `<NumberField label="Calls at once" bind:value={calls} min={1} max={32} />`
-->
<script lang="ts">
  import Icon from './Icon.svelte';

  /** Props of number entry. */
  interface Props {
    /** The value, bound by the caller. */
    value?: number;
    /** The lowest accepted value. */
    min?: number;
    /** The highest accepted value. */
    max?: number;
    /** The increment of Up and Down; 1 when not given. */
    step?: number;
    /** The visible unit after the value, e.g. "MB". */
    unit?: string;
    /** The unit word used in `aria-valuetext`, e.g. "megabytes"; `unit` when absent. */
    unitText?: string;
    /** The accessible name of the spinbutton. */
    label: string;
    /** Whether the field is disabled. */
    disabled?: boolean;
    /** Receives every accepted value. */
    onchange?: (value: number) => void;
  }

  let {
    value = $bindable(0),
    min,
    max,
    step = 1,
    unit,
    unitText,
    label,
    disabled = false,
    onchange
  }: Props = $props();

  /** How long typed digits collect into one value. */
  const TYPING_PAUSE = 1000;

  let typed = '';
  let typingTimer: ReturnType<typeof setTimeout> | undefined;

  const atMin = $derived(min !== undefined && value <= min);
  const atMax = $derived(max !== undefined && value >= max);
  const valueText = $derived(
    unitText === undefined && unit === undefined ? undefined : `${value} ${unitText ?? unit}`
  );

  /**
   * Rounds away floating-point drift from fractional steps.
   *
   * @param next The raw value.
   * @returns The value to store.
   */
  function round(next: number): number {
    return Math.round(next * 1e6) / 1e6;
  }

  /**
   * Clamps a value to the limits, stores it and tells the caller.
   *
   * @param next The wanted value.
   */
  function set(next: number): void {
    let bounded = round(next);
    if (min !== undefined && bounded < min) {
      bounded = min;
    }
    if (max !== undefined && bounded > max) {
      bounded = max;
    }
    if (bounded === value) {
      return;
    }
    value = bounded;
    onchange?.(bounded);
  }

  /**
   * Handles the spinbutton keyboard.
   *
   * @param event The keydown event.
   */
  function keydown(event: KeyboardEvent): void {
    if (disabled) {
      return;
    }
    switch (event.key) {
      case 'ArrowUp':
        set(value + step);
        break;
      case 'ArrowDown':
        set(value - step);
        break;
      case 'PageUp':
        set(value + step * 10);
        break;
      case 'PageDown':
        set(value - step * 10);
        break;
      case 'Home':
        if (min === undefined) {
          return;
        }
        set(min);
        break;
      case 'End':
        if (max === undefined) {
          return;
        }
        set(max);
        break;
      default:
        if (!/^[0-9]$/.test(event.key)) {
          return;
        }
        typed += event.key;
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => (typed = ''), TYPING_PAUSE);
        set(Number(typed));
        break;
    }
    event.preventDefault();
  }
</script>

<div
  class="hs-field hs-field--number"
  class:hs-field--disabled={disabled}
  role="spinbutton"
  tabindex={disabled ? -1 : 0}
  aria-label={label}
  aria-valuenow={value}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuetext={valueText}
  aria-disabled={disabled ? 'true' : undefined}
  onkeydown={keydown}
>
  <span class="hs-field__value">{value}</span>
  {#if unit}
    <span class="hs-field__unit">{unit}</span>
  {/if}
  <button
    class="hs-field__step"
    type="button"
    tabindex="-1"
    aria-label="Decrease"
    disabled={disabled || atMin}
    onclick={() => set(value - step)}
  >
    <Icon name="adwaita-remove" />
  </button>
  <button
    class="hs-field__step"
    type="button"
    tabindex="-1"
    aria-label="Increase"
    disabled={disabled || atMax}
    onclick={() => set(value + step)}
  >
    <Icon name="adwaita-add" />
  </button>
</div>
