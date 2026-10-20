<!--
  A seek or volume slider (k08).

  The thick acid track has no thumb at rest; the thumb appears on keyboard
  focus. The buffered length is shown behind the elapsed one. Clicking the
  track jumps and dragging scrubs. Seek: Left and Right move 5 s, Page Up and
  Page Down 30 s, Home and End jump to the ends. Volume: Left and Right or Up
  and Down move 5, Home and End jump to the ends.

  Usage:
  `<Slider kind="seek" label="Seek" bind:value={position} max={duration} valuetext={...} />`
  `<Slider kind="volume" label="Volume" bind:value={volume} />`
-->
<script lang="ts">
  /** Where the slider takes its keyboard steps from. */
  export type SliderKind = 'seek' | 'volume';

  /** Props of a slider. */
  interface Props {
    /** Seek or volume key map; seek when not given. */
    kind?: SliderKind;
    /** The accessible name, e.g. "Seek" or "Volume". */
    label: string;
    /** The value, bound by the caller. */
    value?: number;
    /** The lowest value; 0 when not given. */
    min?: number;
    /** The highest value; 100 when not given. */
    max?: number;
    /** The keyboard increment; 5 when not given. */
    step?: number;
    /** The Page Up and Page Down increment; 30 when not given. */
    pageStep?: number;
    /** The buffered value, drawn behind the elapsed length. */
    buffer?: number;
    /** The spoken value, e.g. "1 minute 23 seconds of 3 minutes 57 seconds". */
    valuetext?: string;
    /** The disabled state; the control is inert and has no thumb. */
    disabled?: boolean;
    /** Receives every value while the pointer drags or a key moves. */
    onchange?: (value: number) => void;
  }

  let {
    kind = 'seek',
    label,
    value = $bindable(0),
    min = 0,
    max = 100,
    step = 5,
    pageStep = 30,
    buffer,
    valuetext,
    disabled = false,
    onchange
  }: Props = $props();

  let slider: HTMLDivElement | undefined = $state();
  let dragging = $state(false);

  const span = $derived(Math.max(max - min, 0));

  /**
   * Turns a value into a length of the track.
   *
   * @param of The value.
   * @returns The length in percent, clamped to 0-100.
   */
  function percent(of: number | undefined): number {
    if (of === undefined || span === 0) {
      return 0;
    }
    return Math.min(100, Math.max(0, ((of - min) / span) * 100));
  }

  const elapsed = $derived(percent(value));
  const buffered = $derived(percent(buffer));
  const spoken = $derived(
    valuetext ?? (kind === 'volume' ? `${Math.round(value)} percent` : String(value))
  );

  /**
   * Clamps, rounds to avoid floating-point drift, stores and reports a value.
   *
   * @param next The wanted value.
   */
  function set(next: number): void {
    const bounded = Math.min(max, Math.max(min, Math.round(next * 100) / 100));
    if (bounded === value) {
      return;
    }
    value = bounded;
    onchange?.(bounded);
  }

  /**
   * Sets the value from a pointer position over the track.
   *
   * @param event The pointer event.
   */
  function setFromPointer(event: PointerEvent): void {
    if (disabled || slider === undefined) {
      return;
    }
    const rect = slider.getBoundingClientRect();
    if (rect.width === 0) {
      return;
    }
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    set(min + ratio * span);
  }

  /**
   * Starts a drag from anywhere on the track.
   *
   * @param event The pointer event.
   */
  function pointerdown(event: PointerEvent): void {
    if (disabled) {
      return;
    }
    event.preventDefault();
    dragging = true;
    slider?.setPointerCapture(event.pointerId);
    setFromPointer(event);
  }

  /**
   * Follows a drag.
   *
   * @param event The pointer event.
   */
  function pointermove(event: PointerEvent): void {
    if (dragging) {
      setFromPointer(event);
    }
  }

  /**
   * Ends a drag.
   *
   * @param event The pointer event.
   */
  function pointerup(event: PointerEvent): void {
    if (!dragging) {
      return;
    }
    dragging = false;
    if (slider?.hasPointerCapture(event.pointerId)) {
      slider.releasePointerCapture(event.pointerId);
    }
  }

  /**
   * Handles the slider key map.
   *
   * @param event The keydown event.
   */
  function keydown(event: KeyboardEvent): void {
    if (disabled) {
      return;
    }
    switch (event.key) {
      case 'ArrowLeft':
        set(value - step);
        break;
      case 'ArrowRight':
        set(value + step);
        break;
      case 'ArrowUp':
        if (kind !== 'volume') {
          return;
        }
        set(value + step);
        break;
      case 'ArrowDown':
        if (kind !== 'volume') {
          return;
        }
        set(value - step);
        break;
      case 'PageUp':
        if (kind !== 'seek') {
          return;
        }
        set(value + pageStep);
        break;
      case 'PageDown':
        if (kind !== 'seek') {
          return;
        }
        set(value - pageStep);
        break;
      case 'Home':
        set(min);
        break;
      case 'End':
        set(max);
        break;
      default:
        return;
    }
    event.preventDefault();
  }
</script>

<div
  bind:this={slider}
  class="hs-slider"
  role="slider"
  tabindex={disabled ? -1 : 0}
  aria-label={label}
  aria-valuenow={Math.round(value * 100) / 100}
  aria-valuemin={min}
  aria-valuemax={max}
  aria-valuetext={spoken}
  aria-disabled={disabled ? 'true' : undefined}
  onkeydown={keydown}
  onpointerdown={pointerdown}
  onpointermove={pointermove}
  onpointerup={pointerup}
  onpointercancel={pointerup}
>
  <span class="hs-slider__track"></span>
  {#if buffer !== undefined}
    <span class="hs-slider__buffer" style:width="{buffered}%"></span>
  {/if}
  <span class="hs-slider__elapsed" style:width="{elapsed}%"></span>
  <span class="hs-slider__thumb" style:left="{elapsed}%"></span>
</div>
