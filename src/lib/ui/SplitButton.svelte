<!--
  A split button (k01): the action first, the arrow that opens its menu second.

  Both segments share the fill and the busy and disabled states. They are two
  tab stops, the action first; the arrow is named "More options for <action>"
  and reports whether its menu is expanded.

  Usage:
  `<SplitButton actionLabel="Play" icon="adwaita-play" onaction={play} onmenu={open} />`
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import Button from './Button.svelte';
  import type { ButtonVariant } from './Button.svelte';

  /** Props of a split button. */
  interface Props {
    /** The visible label of the action segment, also the base of the arrow's name. */
    actionLabel: string;
    /** The leading icon of the action segment. */
    icon?: IconName;
    /** The fill both segments share. */
    variant?: Exclude<ButtonVariant, 'flat'>;
    /** Whether the action is working; both segments ignore presses. */
    busy?: boolean;
    /** Whether both segments are disabled. */
    disabled?: boolean;
    /** Whether the arrow's menu is expanded. */
    expanded?: boolean;
    /** Receives the activation of the action segment. */
    onaction: () => void;
    /** Receives the activation of the arrow segment. */
    onmenu: () => void;
  }

  let {
    actionLabel,
    icon,
    variant = 'suggested',
    busy = false,
    disabled = false,
    expanded = false,
    onaction,
    onmenu
  }: Props = $props();
</script>

<div class="hs-button-group">
  <Button {variant} {icon} {busy} {disabled} onclick={onaction}>{actionLabel}</Button>
  <Button
    shape="split"
    {variant}
    icon="adwaita-expand"
    label="More options for {actionLabel}"
    {disabled}
    {expanded}
    haspopup="menu"
    onclick={onmenu}
  />
</div>
