<!--
  A row health indicator (k10).

  A 22 px tinted circle with the state's glyph, announced as an image with
  the state's label, which also shows in a tooltip on hover and when the row
  is focused.

  Usage:
  `<HealthIndicator state="success" label="Healthy" />`
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import Icon from './Icon.svelte';
  import { tooltip } from './tooltip.svelte';

  /** The health states a row can report. */
  export type HealthState = 'success' | 'warning' | 'error' | 'neutral';

  /** Props of a health indicator. */
  interface Props {
    /** The state colour and glyph. */
    state: HealthState;
    /** The accessible name and tooltip text; use the copy spec's words. */
    label: string;
  }

  let { state, label }: Props = $props();

  const GLYPHS: Record<HealthState, IconName> = {
    success: 'adwaita-check',
    warning: 'adwaita-warning',
    error: 'adwaita-error',
    neutral: 'custom-unknown'
  };

  const className = $derived(
    ['hs-health-indicator', state === 'neutral' ? '' : `hs-health-indicator--${state}`]
      .filter(Boolean)
      .join(' ')
  );
</script>

<span class={className} role="img" aria-label={label} {@attach tooltip(label)}>
  <Icon name={GLYPHS[state]} />
</span>
