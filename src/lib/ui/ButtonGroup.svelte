<!--
  A linked group of toggle buttons (k01).

  The segments are drawn by `hs-button-group` with 1 px gaps and outer corners
  only. The group is one tab stop: Left and Right move between the segments,
  and Space or Enter flips the focused one.

  Usage:
  `<ButtonGroup label="Playback speed" items={speeds} />`
-->
<script lang="ts">
  import Button from './Button.svelte';
  import type { ButtonVariant } from './Button.svelte';

  /** One toggle of the group. */
  export interface GroupItem {
    /** The visible label and the accessible name of the toggle. */
    label: string;
    /** Whether the toggle is on. */
    pressed: boolean;
    /** Receives the activation of the toggle. */
    onpress?: () => void;
  }

  /** Props of a linked group. */
  interface Props {
    /** The accessible name of the group, e.g. "Playback speed". */
    label: string;
    /** The toggles, in reading order. */
    items: GroupItem[];
    /** The fill every segment shares. */
    variant?: ButtonVariant;
  }

  let { label, items, variant = 'tonal' }: Props = $props();

  let group: HTMLDivElement | undefined = $state();
  let active = $state(0);

  /**
   * Moves the group's single tab stop and focus to another segment.
   *
   * @param index The index to move to, wrapped into the group.
   */
  function moveTo(index: number): void {
    if (items.length === 0) {
      return;
    }
    active = (index + items.length) % items.length;
    const buttons = group?.querySelectorAll<HTMLButtonElement>('button');
    buttons?.[active]?.focus();
  }

  /**
   * Handles Left and Right on a segment.
   *
   * @param event The keydown event.
   * @param index The index of the segment that has focus.
   */
  function keydown(event: KeyboardEvent, index: number): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      moveTo(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      moveTo(index + 1);
    }
  }
</script>

<div class="hs-button-group" role="group" aria-label={label} bind:this={group}>
  {#each items as item, index (item.label)}
    <Button
      {variant}
      pressed={item.pressed}
      tabindex={index === active ? 0 : -1}
      onkeydown={(event) => keydown(event, index)}
      onclick={() => {
        active = index;
        item.onpress?.();
      }}
    >
      {item.label}
    </Button>
  {/each}
</div>
