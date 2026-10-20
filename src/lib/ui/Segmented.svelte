<!--
  A segmented control (k23).

  A tab strip with exactly two visual states, selected and unselected. It is
  one tab stop: Left and Right move and select, Home and End jump, and Tab
  moves into the panel. The selected segment scrolls into view on phones.
  The flush variant has no margin for the now-playing panel. The selected look
  slides between segments (a thumb under the tabs, sized from the selected one).

  Usage:
  `<Segmented label="Lyrics or queue" segments={lyricsQueue} bind:value={view} />`
-->
<script lang="ts">
  /** One segment of the strip. */
  export interface Segment {
    /** The value the caller stores. */
    value: string;
    /** The visible label and the tab's accessible name. */
    label: string;
  }

  /** Props of a segmented control. */
  interface Props {
    /** The accessible name of the tab list. */
    label: string;
    /** The segments, in reading order. */
    segments: Segment[];
    /** The selected value, bound by the caller. */
    value?: string;
    /** Drops the 14 px outer margin for the now-playing panel. */
    flush?: boolean;
    /** Receives a new selection. */
    onchange?: (value: string) => void;
  }

  let { label, segments, value = $bindable(), flush = false, onchange }: Props = $props();

  let buttons: (HTMLButtonElement | undefined)[] = $state([]);

  const selectedIndex = $derived(
    Math.max(
      segments.findIndex((segment) => segment.value === value),
      0
    )
  );

  /** Offset and width of the sliding selection, in pixels, from the selected tab. */
  let thumb = $state({ x: 0, width: 0 });

  $effect(() => {
    const selected = buttons[selectedIndex];
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (selected === undefined) {
      return;
    }
    // The thumb follows the selected tab, also when a label or the font changes its width.
    const measure = (): void => {
      thumb = { x: selected.offsetLeft, width: selected.offsetWidth };
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(selected);
    return () => observer.disconnect();
  });

  /**
   * Selects a segment and moves focus to it.
   *
   * @param index The segment to select.
   */
  function select(index: number): void {
    const segment = segments[index];
    if (segment === undefined) {
      return;
    }
    if (segment.value !== value) {
      value = segment.value;
      onchange?.(segment.value);
    }
    buttons[index]?.focus();
  }

  /**
   * Handles the tab list's arrow, Home and End keys.
   *
   * @param event The keydown event.
   * @param index The segment that has focus.
   */
  function keydown(event: KeyboardEvent, index: number): void {
    let next: number | undefined;
    switch (event.key) {
      case 'ArrowLeft':
        next = (index - 1 + segments.length) % segments.length;
        break;
      case 'ArrowRight':
        next = (index + 1) % segments.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = segments.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    select(next);
  }
</script>

<div class="hs-segmented" class:hs-segmented--flush={flush} role="tablist" aria-label={label}>
  <span
    class="hs-segmented__thumb"
    style:--hs-segment-x="{thumb.x}px"
    style:--hs-segment-w="{thumb.width}px"
    aria-hidden="true"
  ></span>
  {#each segments as segment, index (segment.value)}
    <button
      bind:this={buttons[index]}
      class="hs-segmented__tab"
      class:hs-segmented__tab--selected={segment.value === value}
      type="button"
      role="tab"
      aria-selected={segment.value === value}
      tabindex={index === selectedIndex ? 0 : -1}
      onclick={() => select(index)}
      onkeydown={(event) => keydown(event, index)}
    >
      {segment.label}
    </button>
  {/each}
</div>
