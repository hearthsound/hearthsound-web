<!--
  Number entry with minus and plus at the end (k04).

  The field is a text input that accepts digits only, so a value can be typed,
  selected and cleared like any other field; the characters that are not digits
  never appear. Up and Down step by one, Page Up and Page Down by ten, Home and
  End jump to the limits, and Enter or leaving the field commits the typed
  value, clamped to the limits. The 28 px step buttons are not tab stops; at a
  limit the matching step is disabled at 40%. The visible unit is repeated in
  `aria-valuetext`.

  An optional field may start empty: k04 draws no empty state of its own, so
  `empty` blanks the field and the first digit fills it, while emptying the text
  or pressing Backspace in an empty field draws it again. A quota uses it for
  "no limit".

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

  let input: HTMLInputElement | undefined = $state();
  let focused = $state(false);
  /** The text the input shows; digits only, empty while the field is empty. */
  let text = $state(empty ? '' : String(value));

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

  // A value set from outside (a reset, a step) updates the text the reader sees,
  // unless they are in the middle of typing.
  $effect(() => {
    const next = empty ? '' : String(value);
    if (!focused) {
      text = next;
    }
  });

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
    value = bounded;
    empty = false;
    text = String(bounded);
    onchange?.(bounded);
  }

  /**
   * Reads what the reader typed: digits only, and an empty field stays empty.
   */
  function typed(): void {
    if (input === undefined) {
      return;
    }
    const digits = input.value.replace(/[^0-9]/g, '');
    if (digits !== input.value) {
      input.value = digits;
    }
    text = digits;
    if (digits === '') {
      empty = true;
      onchange?.(null);
      return;
    }
    const next = Number(digits);
    if (Number.isFinite(next)) {
      value = next;
      empty = false;
      onchange?.(next);
    }
  }

  /**
   * Commits the typed value: clamps it to the limits, or keeps the field empty.
   */
  function settle(): void {
    focused = false;
    if (input === undefined) {
      return;
    }
    if (input.value === '') {
      empty = true;
      text = '';
      onchange?.(null);
      return;
    }
    const next = Number(input.value.replace(/[^0-9]/g, ''));
    set(Number.isFinite(next) ? next : (min ?? 0));
  }

  /**
   * Handles the spinbutton keys the input does not handle itself.
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
        if (empty) {
          event.preventDefault();
          return;
        }
        // The input clears its own last digit; an emptied field stays empty.
        return;
      case 'Enter':
        settle();
        return;
      default:
        return;
    }
    event.preventDefault();
  }
</script>

<div class="hs-field hs-field--number" class:hs-field--disabled={disabled}>
  <input
    class="hs-field__input"
    bind:this={input}
    type="text"
    inputmode="numeric"
    autocomplete="off"
    spellcheck="false"
    {disabled}
    value={text}
    role="spinbutton"
    aria-label={label}
    aria-valuenow={empty ? undefined : value}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuetext={valueText}
    onfocus={() => (focused = true)}
    oninput={typed}
    onblur={settle}
    onkeydown={keydown}
  />
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
