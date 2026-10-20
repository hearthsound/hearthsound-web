<!--
  A message banner (k21 B).

  A rounded tinted card with a state glyph, up to two lines of text and one
  regular button. Warnings are announced politely, errors assertively. The
  floating modifier gives it the l11b elevation; the shell places it in the
  overlay dock.

  Usage:
  ```
  <Banner level="warning" floating actions={retry}>Your session ended.</Banner>
  ```
-->
<script lang="ts" module>
  /** The state a banner reports. */
  export type BannerLevel = 'warning' | 'error' | 'success';
</script>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { IconName } from '@hearthsound/design/icons';

  import Icon from './Icon.svelte';

  /** Props of the banner. */
  interface Props extends HTMLAttributes<HTMLDivElement> {
    /** The state colour, glyph and live-region role; warning by default. */
    level?: BannerLevel;
    /** Adds the l11b elevation for a banner that floats above the content. */
    floating?: boolean;
    /** The message as plain text. */
    text?: string;
    /** The message as markup, for a line that holds more than text. */
    children?: Snippet;
    /** The buttons at the right, or below on phones. */
    actions?: Snippet;
  }

  let {
    level = 'warning',
    floating = false,
    text,
    children,
    actions,
    role: givenRole,
    class: extra = '',
    ...rest
  }: Props = $props();

  /** The glyph each state shows. */
  const GLYPHS: Record<BannerLevel, IconName> = {
    warning: 'adwaita-warning',
    error: 'adwaita-error',
    success: 'adwaita-check'
  };

  const glyph = $derived(GLYPHS[level]);
  const liveRole = $derived(givenRole ?? (level === 'error' ? 'alert' : 'status'));
</script>

<div
  {...rest}
  class="hs-banner hs-banner--{level} {extra}"
  class:hs-banner--floating={floating}
  role={liveRole}
>
  <Icon name={glyph} class="hs-banner__glyph" />
  <div class="hs-banner__text">
    {#if text !== undefined}
      <span>{text}</span>
    {/if}
    {@render children?.()}
  </div>
  {#if actions}
    <div class="hs-banner__actions">{@render actions()}</div>
  {/if}
</div>
