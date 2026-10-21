<!--
  Number entry with minus and plus at the end (k04).

  The field is a spinbutton: Up and Down step by one, Page Up and Page Down by
  ten, Home and End jump to the limits, and typing digits replaces the value.
  The 28 px step buttons are not tab stops; at a limit the matching step is
  disabled at 40%. The visible unit is repeated in `aria-valuetext`.

  An optional field may start empty: k04 draws no empty state of its own, so
  `empty` blanks the value and the first step or digit fills it, while Backspace
  or Delete empties it again. A quota uses it for "no limit".

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
    /**
     * Whether the field holds no value; the caller binds it when an empty field
     * means something other than zero. The field clears it once a value is
     * entered.
     */
    empty?: boolean;
    /** Receives every accepted value, and `null` when the field is emptied. */
    onchange?: (value: number | null) => void;
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
    empty = $bindable(false),
    onchange
  }: Props = $props();

  /** How long typed digits collect into one value. */
  const TYPING_PAUSE = 1000;

  let typed = '';
  let typingTimer: ReturnType<typeof setTimeout> | undefined;

  /** What a step starts from: the empty field sits at its lowest value. */
  const base = $derived(empty ? (min ?? 0) : value);

  const atMin = $derived(min !== undefined && base <= min);
  const atMax = $derived(max !== undefined && base >= max);
  const valueText = $derived(
    empty
      ? 'Empty'
      : unitText === undefined && unit === undefined
        ? undefined
        : `${value} ${unitText ?? unit}`
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
    if (bounded === value && !empty) {
      return;
    }
    value = bounded;
    empty = false;
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
        set(base + step);
        break;
      case 'ArrowDown':
        if (empty) {
          break;
        }
        set(base - step);
        break;
      case 'PageUp':
        set(base + step * 10);
        break;
      case 'PageDown':
        if (empty) {
          break;
        }
        set(base - step * 10);
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
      case 'Backspace':
      case 'Delete':
        if (empty) {
          break;
        }
        empty = true;
        typed = '';
        onchange?.(null);
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
  aria-valuenow={empty ? undefined : value}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuetext={valueText}
  aria-disabled={disabled ? 'true' : undefined}
  onkeydown={keydown}
>
  <span class="hs-field__value">{empty ? '' : value}</span>
  {#if unit}
    <span class="hs-field__unit">{unit}</span>
  {/if}
  <button
    class="hs-field__step"
    type="button"
    tabindex="-1"
    aria-label="Decrease"
    disabled={disabled || atMin}
    onclick={() => set(base - step)}
  >
    <Icon name="adwaita-remove" />
  </button>
  <button
    class="hs-field__step"
    type="button"
    tabindex="-1"
    aria-label="Increase"
    disabled={disabled || atMax}
    onclick={() => set(base + step)}
  >
    <Icon name="adwaita-add" />
  </button>
</div>
