<!--
  One file in the upload queue (k31-r1, p21-r1).

  The row carries the file's name and size and one k10 pill with its state:
  Waiting, Uploading N%, Processing, Done or Failed: reason. There is no
  progress bar; the pill is a live region, so each state change is announced.

  Usage:
  `<UploadItem name={item.fileName} size="42.6 MB" state={item.state}
    progress={item.percent} reason={item.reason} />`
-->
<script lang="ts" module>
  /** The state of one upload. */
  export type UploadRowState = 'queued' | 'uploading' | 'processing' | 'done' | 'failed';
</script>

<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import Icon from './Icon.svelte';

  /** Props of the row. */
  interface Props {
    /** The file's name. */
    name: string;
    /** The formatted file size. */
    size: string;
    /** What the queue is doing with the file. */
    state: UploadRowState;
    /** The uploaded percentage, for `uploading`. */
    progress?: number;
    /** Why the upload failed, for `failed`. */
    reason?: string;
  }

  let { name, size, state, progress = 0, reason }: Props = $props();

  const pill = $derived.by((): { tone: string; icon: IconName; text: string } => {
    switch (state) {
      case 'queued':
        return { tone: 'neutral', icon: 'adwaita-queue', text: 'Waiting' };
      case 'uploading':
        return { tone: 'accent', icon: 'custom-upload', text: `Uploading ${progress}%` };
      case 'processing':
        return { tone: 'accent', icon: 'adwaita-refresh', text: 'Processing' };
      case 'done':
        return { tone: 'success', icon: 'adwaita-check', text: 'Done' };
      case 'failed':
        return {
          tone: 'error',
          icon: 'adwaita-error',
          text: `Failed: ${reason === undefined || reason === '' ? 'the upload did not go through' : reason}`
        };
    }
  });
</script>

<div class="hs-setting-row hs-setting-row--two-line hs-upload-row">
  <Icon name="adwaita-song" class="hs-setting-row__icon" />
  <span class="hs-setting-row__text">
    <span>{name}</span>
    <span class="hs-setting-row__subtitle">{size}</span>
  </span>
  <span class="hs-pill hs-pill--{pill.tone}" role="status">
    <Icon name={pill.icon} class="hs-pill__glyph" />
    {pill.text}
  </span>
</div>
