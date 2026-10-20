<!--
  A loading placeholder (k09b).

  The skeleton holds the space of the content it stands in for and is hidden
  from assistive technology. Its box is set by the caller: `width` and
  `height` take any CSS length and `radius` one of the token steps.

  Usage:
  `<Skeleton width="100%" height="120px" radius="art" />`
-->
<script lang="ts" module>
  /** The radius tokens a skeleton may take. */
  export type SkeletonRadius =
    'control' | 'row' | 'card' | 'art-small' | 'art' | 'popover' | 'dialog' | 'full';
</script>

<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  /** Props of a skeleton. */
  interface Props extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
    /** The width of the placeholder, e.g. "100%". */
    width?: string;
    /** The height of the placeholder, e.g. "18px". */
    height?: string;
    /** The radius token the content uses; 4 px when not given. */
    radius?: SkeletonRadius;
  }

  let { width, height, radius, class: extra = '', ...rest }: Props = $props();
</script>

<span
  {...rest}
  class="hs-skeleton {extra}"
  style:width
  style:height
  style:border-radius={radius === undefined ? undefined : `var(--hs-radius-${radius})`}
  aria-hidden="true"
></span>
