<!--
  One icon from the design package's sprite.

  With a `label` the icon is announced as an image with that name; without one
  it is decorative and hidden from assistive technology. Without `size` the
  package sizes the icon for the component it sits in (e.g. 20 px in the play
  disc) or falls back to 16 px; an explicit `size` (an approved size, spec
  foundations 9.2) overrides that through `--hs-icon-size`.

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
    /**
     * The rendered size in pixels. When absent the package decides: the
     * component the icon sits in sizes it (e.g. 20 px in the play disc), else
     * the 16 px default of `hs-icon`.
     */
    size?: IconSize;
    /** The accessible name; when absent the icon is decorative. */
    label?: string;
    /** Extra classes for the part the icon plays in a component, e.g. `hs-button__icon`. */
    class?: string;
  }

  let { name, size, label, class: extra = '' }: Props = $props();
</script>

{#if label === undefined}
  <svg
    class="hs-icon {extra}"
    style:--hs-icon-size={size === undefined ? undefined : `${size}px`}
    aria-hidden="true"
    focusable="false"
  >
    <use href="{sprite}#{name}" />
  </svg>
{:else}
  <svg
    class="hs-icon {extra}"
    style:--hs-icon-size={size === undefined ? undefined : `${size}px`}
    role="img"
    aria-label={label}
    focusable="false"
  >
    <use href="{sprite}#{name}" />
  </svg>
{/if}
