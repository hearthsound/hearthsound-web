<!--
  One icon from the design package's sprite.

  With a `label` the icon is announced as an image with that name; without one
  it is decorative and hidden from assistive technology. The size is one of the
  approved icon sizes (spec foundations 9.2) and reaches the package's
  `hs-icon` class through `--hs-icon-size`.

  Usage: `<Icon name="adwaita-play" size={20} />` or
  `<Icon name="adwaita-error" label="Failed" />`.
-->
<script lang="ts" module>
  /** The icon sizes the design approves, in pixels (foundations 9.2). */
  export type IconSize = 12 | 14 | 16 | 18 | 20 | 24 | 28 | 40 | 64;
</script>

<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';
  import sprite from '@hearthsound/design/icons.svg?url';

  /** Props of an icon. */
  interface Props {
    /** The sprite id of the icon. */
    name: IconName;
    /** The rendered size in pixels; 16 when not given. */
    size?: IconSize;
    /** The accessible name; when absent the icon is decorative. */
    label?: string;
    /** Extra classes for the part the icon plays in a component, e.g. `hs-button__icon`. */
    class?: string;
  }

  let { name, size = 16, label, class: extra = '' }: Props = $props();
</script>

{#if label === undefined}
  <svg class="hs-icon {extra}" style:--hs-icon-size="{size}px" aria-hidden="true" focusable="false">
    <use href="{sprite}#{name}" />
  </svg>
{:else}
  <svg
    class="hs-icon {extra}"
    style:--hs-icon-size="{size}px"
    role="img"
    aria-label={label}
    focusable="false"
  >
    <use href="{sprite}#{name}" />
  </svg>
{/if}
