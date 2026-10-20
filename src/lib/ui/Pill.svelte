<!--
  A status pill (k10).

  The tone picks the state colour on its status tint; every pill carries a
  glyph and its visible label, never colour alone. Pills are not focusable:
  one that opens details sits inside a focusable row or button.

  Usage:
  `<Pill tone="error" glyph="adwaita-error" label="Failed" />`
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import Icon from './Icon.svelte';

  /** The tones a pill may take. */
  export type PillTone = 'success' | 'warning' | 'error' | 'neutral' | 'accent';

  /** Props of a pill. */
  interface Props {
    /** The state colour; neutral when not given. */
    tone?: PillTone;
    /** The glyph of the state group; pills always carry one. */
    glyph: IconName;
    /** The visible label, which is also the accessible text. */
    label: string;
  }

  let { tone = 'neutral', glyph, label }: Props = $props();

  const className = $derived(
    ['hs-pill', tone === 'neutral' ? '' : `hs-pill--${tone}`].filter(Boolean).join(' ')
  );
</script>

<span class={className}>
  <Icon name={glyph} class="hs-pill__glyph" />
  {label}
</span>
