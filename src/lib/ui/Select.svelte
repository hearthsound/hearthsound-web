<!--
  A drop-down (k05).

  The closed control is the tonal field with a muted chevron, named by its
  label plus the current value. Opening turns the chevron and takes the hover
  tone and shows the `hs-listbox` popover of `hs-option` items, with the
  current choice checked. Enter, Space, Down or Alt+Down
  open; Up and Down move, Home and End jump, Enter or Space choose, Escape
  closes without changing and Tab chooses and moves on. Typing a letter on
  the closed control jumps to the next option starting with it.

  The list is `position: fixed` and placed against the viewport by
  {@link popoverPlacement}, so a settings group or a dialog that clips its
  overflow cannot cut it off; it keeps the control's width and follows the
  control while the page scrolls or the window resizes. It stays in the
  control's subtree, so its focus handling and its ARIA stay together.

  Usage:
  `<Select label="Format" bind:value={format} options={formats} />`
-->
<script lang="ts">
  import { tick } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import Icon from './Icon.svelte';
  import { POPOVER_MARGIN, popoverPlacement } from './popover-placement';

  /** One choice of the list. */
  export interface SelectOption {
    /** The value the caller stores. */
    value: string;
    /** The visible label of the option and of the closed control. */
    label: string;
  }

  /** Props of a drop-down. */
  interface Props extends Omit<
    HTMLButtonAttributes,
    'value' | 'children' | 'onclick' | 'onkeydown' | 'onchange'
  > {
    /** The choices, in reading order. */
    options: SelectOption[];
    /** The chosen value, bound by the caller. */
    value?: string;
    /**
     * The accessible name's base when the control has no visible label of its
     * own; the current value is appended to it.
     */
    label?: string;
    /** The disabled state. */
    disabled?: boolean;
    /** The invalid state, paired with a form field's error. */
    invalid?: boolean;
    /** Whether the list is open; bindable for a preview or a test. */
    open?: boolean;
    /** Receives a new choice. */
    onchange?: (value: string) => void;
  }

  let {
    options,
    value = $bindable(),
    label,
    disabled = false,
    invalid = false,
    open = $bindable(false),
    onchange,
    id,
    name,
    class: extra = '',
    ...rest
  }: Props = $props();

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let wrapper: HTMLDivElement | undefined = $state();
  let trigger: HTMLButtonElement | undefined = $state();
  let list: HTMLUListElement | undefined = $state();
  let optionEls: (HTMLLIElement | undefined)[] = $state([]);
  let active = $state(0);

  const current = $derived(options.find((option) => option.value === value));
  const currentIndex = $derived(options.findIndex((option) => option.value === value));

  const accessibleLabel = $derived(
    label === undefined ? undefined : `${label} ${current?.label ?? ''}`
  );
  const labelledBy = $derived(
    label === undefined && id !== undefined ? `${id}-label ${id}-value` : undefined
  );

  /**
   * Places the open list against the viewport from the control's rectangle.
   *
   * The list keeps the control's width, so a short label in a wide control does
   * not narrow it, and it may not run past the viewport's right edge, which
   * is where a long label wraps instead.
   */
  function place(): void {
    if (trigger === undefined || list === undefined) {
      return;
    }
    const rect = trigger.getBoundingClientRect();
    // Pinned before it is measured, so the width taken below is the panel's own
    // and not the width of the box it sits in.
    list.style.position = 'fixed';
    list.style.minWidth = '';
    list.style.maxWidth = '';
    list.style.maxHeight = '';
    list.style.overflowY = '';
    const width = Math.max(list.offsetWidth, rect.width);
    const where = popoverPlacement(
      rect,
      { width, height: list.offsetHeight },
      { width: window.innerWidth, height: window.innerHeight },
      { matchWidth: true }
    );
    list.style.left = `${Math.round(where.left)}px`;
    list.style.top = `${Math.round(where.top)}px`;
    list.style.minWidth = `${Math.round(where.width ?? rect.width)}px`;
    list.style.maxWidth = `${Math.round(window.innerWidth - POPOVER_MARGIN - where.left)}px`;
    if (where.maxHeight !== null) {
      list.style.maxHeight = `${where.maxHeight}px`;
      list.style.overflowY = 'auto';
    }
    list.style.visibility = 'visible';
  }

  /**
   * Opens the list with the current choice highlighted and moves focus to it.
   *
   * @param index The option to highlight; the current choice when not given.
   */
  async function openList(index?: number): Promise<void> {
    if (disabled) {
      return;
    }
    active = index ?? Math.max(currentIndex, 0);
    open = true;
    await tick();
    place();
    optionEls[active]?.focus();
  }

  /**
   * Closes the list and returns focus to the trigger.
   *
   * @param refocus Whether to focus the trigger.
   */
  function closeList(refocus = true): void {
    open = false;
    if (refocus) {
      trigger?.focus();
    }
  }

  /**
   * Focuses the tab stop after (or before) the control, standing in for the
   * Tab that a listbox option does not pass on.
   *
   * @param direction 1 for the next tab stop, -1 for the previous one.
   */
  function focusAdjacent(direction: 1 | -1): void {
    if (trigger === undefined) {
      return;
    }
    const all = Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element === trigger || !(wrapper?.contains(element) ?? false)
    );
    const at = all.indexOf(trigger);
    all[at + direction]?.focus();
  }

  /**
   * Chooses an option and closes the list, optionally moving on to the next
   * tab stop as Tab does.
   *
   * @param index The option to choose.
   * @param direction 0 to return focus to the trigger, 1 or -1 to move on.
   */
  function choose(index: number, direction: 0 | 1 | -1 = 0): void {
    const option = options[index];
    if (option !== undefined && option.value !== value) {
      value = option.value;
      onchange?.(option.value);
    }
    open = false;
    trigger?.focus();
    if (direction !== 0) {
      focusAdjacent(direction);
    }
  }

  /**
   * Moves the highlight and focus by one option, wrapping at the ends.
   *
   * @param delta The direction to move in.
   */
  function move(delta: number): void {
    if (options.length === 0) {
      return;
    }
    active = (active + delta + options.length) % options.length;
    optionEls[active]?.focus();
  }

  /**
   * Jumps to an option that starts with a typed letter, after the current
   * choice and wrapping.
   *
   * @param letter The typed letter.
   */
  function typeahead(letter: string): void {
    const lower = letter.toLowerCase();
    const from = Math.max(currentIndex, 0);
    for (let step = 1; step <= options.length; step += 1) {
      const index = (from + step) % options.length;
      const option = options[index];
      if (option !== undefined && option.label.toLowerCase().startsWith(lower)) {
        choose(index);
        return;
      }
    }
  }

  /**
   * Handles the closed control's keyboard.
   *
   * @param event The keydown event.
   */
  function triggerKeydown(event: KeyboardEvent): void {
    if (disabled) {
      return;
    }
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      closeList();
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void openList();
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      typeahead(event.key);
    }
  }

  /**
   * Handles the open list's keyboard.
   *
   * @param event The keydown event.
   * @param index The option that has focus.
   */
  function optionKeydown(event: KeyboardEvent, index: number): void {
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        move(-1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        move(1);
        break;
      case 'Home':
        event.preventDefault();
        active = 0;
        optionEls[0]?.focus();
        break;
      case 'End':
        event.preventDefault();
        active = Math.max(options.length - 1, 0);
        optionEls[active]?.focus();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        choose(index);
        break;
      case 'Escape':
        event.preventDefault();
        closeList();
        break;
      case 'Tab':
        event.preventDefault();
        choose(index, event.shiftKey ? -1 : 1);
        break;
      default:
        break;
    }
  }

  /**
   * Closes the list when focus leaves the control entirely.
   *
   * @param event The focusout event.
   */
  function focusout(event: FocusEvent): void {
    const next = event.relatedTarget;
    if (next instanceof Node && wrapper?.contains(next)) {
      return;
    }
    closeList(false);
  }

  $effect(() => {
    // While the list is open it follows its control, and closing it leaves no
    // listener behind.
    if (!open || list === undefined) {
      return;
    }
    place();
    const follow = (): void => {
      place();
    };
    window.addEventListener('resize', follow);
    window.addEventListener('scroll', follow, true);
    return () => {
      window.removeEventListener('resize', follow);
      window.removeEventListener('scroll', follow, true);
    };
  });
</script>

<svelte:window
  onpointerdown={(event) => {
    if (!open) {
      return;
    }
    const target = event.target;
    if (target instanceof Node && wrapper?.contains(target)) {
      return;
    }
    closeList(false);
  }}
/>

<div class="hs-select-wrap" bind:this={wrapper} onfocusout={focusout}>
  {#if name !== undefined}
    <input type="hidden" {name} {value} />
  {/if}
  <button
    {...rest}
    bind:this={trigger}
    {id}
    class="hs-select {extra}"
    class:hs-field--invalid={invalid}
    type="button"
    {disabled}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={accessibleLabel}
    aria-labelledby={labelledBy}
    onclick={() => (open ? closeList() : void openList())}
    onkeydown={triggerKeydown}
  >
    <span class="hs-field__value" id={id === undefined ? undefined : `${id}-value`}>
      {current?.label ?? ''}
    </span>
    <Icon name="adwaita-expand" />
  </button>

  {#if open}
    <ul
      class="hs-listbox hs-select-list"
      role="listbox"
      bind:this={list}
      aria-label={label}
      aria-labelledby={label === undefined && id !== undefined ? `${id}-label` : undefined}
    >
      {#each options as option, index (option.value)}
        <li
          bind:this={optionEls[index]}
          class="hs-option"
          class:hs-option--active={index === active}
          role="option"
          tabindex={index === active ? 0 : -1}
          aria-selected={option.value === value}
          onclick={() => choose(index)}
          onkeydown={(event) => optionKeydown(event, index)}
        >
          {option.label}
          <Icon name="adwaita-check" />
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  /* `place()` pins the list to the viewport and writes its coordinates, so a
     settings group or a dialog that clips its overflow cannot cut it off. It
     stays hidden until it has been placed, so it never paints at the corner of
     its containing block. */
  .hs-select-list {
    z-index: 30;
    visibility: hidden;
  }
</style>
