<!--
  The upload drop panel (k31-r1).

  The panel is a neutral grey surface at rest and takes the acid tint with a
  dashed outline while files are dragged over it. The Suggested "Choose
  files" button opens the file picker; both routes hand the files to `onfiles`
  and the page sends them.

  Usage:
  `<DropZone onfiles={(files) => upload(files)} />`
-->
<script lang="ts">
  import Icon from './Icon.svelte';

  /** Props of the drop panel. */
  interface Props {
    /** Receives the files the picker or a drop answered with. */
    onfiles: (files: FileList) => void;
    /** The file types the picker offers; every audio file when not given. */
    accept?: string;
    /** Whether more than one file may be chosen. */
    multiple?: boolean;
    /** Whether the panel is unavailable. */
    disabled?: boolean;
    /**
     * Whether files are being dragged over the page. A page that tracks the
     * drag itself keeps the panel's drag-over look on with this.
     */
    dragging?: boolean;
  }

  let {
    onfiles,
    accept = 'audio/*',
    multiple = true,
    disabled = false,
    dragging = false
  }: Props = $props();

  let over = $state(false);
  let input = $state<HTMLInputElement>();
  /** Counts the drag events so leaving a child does not clear the drop state. */
  let depth = 0;
  const highlighted = $derived(dragging || over);

  /**
   * Marks the panel as the target of a drag.
   *
   * @param event The drag entering the panel.
   */
  function enter(event: DragEvent): void {
    if (disabled) {
      return;
    }
    event.preventDefault();
    depth += 1;
    over = true;
  }

  /**
   * Allows the drop the drag is carrying.
   *
   * @param event The drag over the panel.
   */
  function dragOver(event: DragEvent): void {
    if (disabled) {
      return;
    }
    event.preventDefault();
  }

  /** Clears the drop state once the drag has left the panel. */
  function leave(): void {
    depth = Math.max(0, depth - 1);
    if (depth === 0) {
      over = false;
    }
  }

  /**
   * Sends the dropped files.
   *
   * @param event The drop on the panel.
   */
  function drop(event: DragEvent): void {
    event.preventDefault();
    depth = 0;
    over = false;
    if (disabled) {
      return;
    }
    const files = event.dataTransfer?.files;
    if (files !== undefined && files.length > 0) {
      onfiles(files);
    }
  }

  /**
   * Sends the files the picker answered with and clears the picker.
   *
   * @param event The change event of the file input.
   */
  function picked(event: Event): void {
    const picker = event.currentTarget as HTMLInputElement;
    if (picker.files !== null && picker.files.length > 0) {
      onfiles(picker.files);
    }
    picker.value = '';
  }
</script>

<div
  class="hs-drop-zone"
  class:hs-drop-zone--over={highlighted}
  role="group"
  aria-label="Drop audio files"
  aria-disabled={disabled || undefined}
  ondragenter={enter}
  ondragover={dragOver}
  ondragleave={leave}
  ondrop={drop}
>
  <Icon name="custom-upload" />
  <span class="hs-drop-zone__hint">Drop audio files here, or choose them.</span>
  <button
    class="hs-button hs-button--suggested"
    type="button"
    {disabled}
    onclick={() => input?.click()}
  >
    Choose files
  </button>
  <input
    class="hs-visually-hidden"
    type="file"
    tabindex="-1"
    {accept}
    {multiple}
    {disabled}
    bind:this={input}
    onchange={picked}
  />
</div>
