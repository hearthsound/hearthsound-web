<!--
  The upload drop panel (k31-r1).

  The panel is a neutral grey surface at rest and takes the acid tint with a
  dashed outline while files are dragged over it. The button opens the file
  picker; both routes hand the files to `onfiles` and the page sends them. The
  default is the audio upload panel; a caller that drops something else names
  its icon, hint, button and group, and the small variant keeps it compact.

  Usage:
  `<DropZone onfiles={(files) => upload(files)} />`
  `<DropZone small icon="adwaita-plugin" label="Plugin archive"
    hint="Drop the archive here, or choose it." buttonLabel="Choose file"
    accept=".hsplugin" multiple={false} suggested={false}
    onfiles={(files) => pick(files[0])} />`
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

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
    /** The leading icon; the audio upload icon when not given. */
    icon?: IconName;
    /** The hint line under the icon. */
    hint?: string;
    /** The visible label of the button that opens the picker. */
    buttonLabel?: string;
    /** The accessible name of the panel. */
    label?: string;
    /** Keeps the panel compact, for a dialog. */
    small?: boolean;
    /** Draws the picker button as the suggested button; true when not given. */
    suggested?: boolean;
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
    dragging = false,
    icon = 'custom-upload',
    hint = 'Drop audio files here, or choose them.',
    buttonLabel = 'Choose files',
    label = 'Drop audio files',
    small = false,
    suggested = true
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
  class:hs-drop-zone--small={small}
  role="group"
  aria-label={label}
  aria-disabled={disabled || undefined}
  ondragenter={enter}
  ondragover={dragOver}
  ondragleave={leave}
  ondrop={drop}
>
  <Icon name={icon} />
  <span class="hs-drop-zone__hint">{hint}</span>
  <button
    class="hs-button"
    class:hs-button--suggested={suggested}
    type="button"
    {disabled}
    onclick={() => input?.click()}
  >
    {buttonLabel}
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
