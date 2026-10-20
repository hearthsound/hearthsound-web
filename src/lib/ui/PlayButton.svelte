<!--
  The play/pause disc (k02).

  The disc carries one of four states: play, pause, fetching (the spinner with
  the accessible name "Pause" and `aria-busy`) and retry (the refresh glyph,
  named "Retry"). It is 44 px in the player bar and the mini player and 64 px
  with `large` in the now-playing view.

  Usage:
  `<PlayButton state="pause" onclick={player.toggle} />`
  `<PlayButton state="fetching" large />`
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import Icon from './Icon.svelte';

  /** What the disc shows. */
  export type PlayState = 'play' | 'pause' | 'fetching' | 'retry';

  /** Props of the disc. */
  interface Props {
    /** The state the disc draws. */
    state: PlayState;
    /** The 64 px now-playing size instead of the 44 px bar size. */
    large?: boolean;
    /** Whether the disc is disabled. */
    disabled?: boolean;
    /** Receives the activation; fetching ignores presses. */
    onclick?: () => void;
  }

  let { state, large = false, disabled = false, onclick }: Props = $props();

  const NAMES: Record<PlayState, string> = {
    play: 'Play',
    pause: 'Pause',
    fetching: 'Pause',
    retry: 'Retry'
  };

  const GLYPHS: Record<'play' | 'pause' | 'retry', IconName> = {
    play: 'adwaita-play',
    pause: 'adwaita-pause',
    retry: 'adwaita-refresh'
  };

  const glyph = $derived(state === 'fetching' ? undefined : GLYPHS[state]);

  /**
   * Reports the activation to the caller, ignoring it while fetching.
   */
  function handleClick(): void {
    if (state === 'fetching' || disabled) {
      return;
    }
    onclick?.();
  }
</script>

<button
  class="hs-play-button"
  class:hs-play-button--large={large}
  type="button"
  aria-label={NAMES[state]}
  aria-busy={state === 'fetching' ? 'true' : undefined}
  {disabled}
  onclick={handleClick}
>
  {#if state === 'fetching'}
    <span class="hs-spinner"></span>
  {:else if glyph !== undefined}
    <Icon name={glyph} />
  {/if}
</button>
