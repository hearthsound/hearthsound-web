<!--
  A sidebar section heading (k24).

  The 11 px uppercase heading above a group of navigation rows. A section names
  its group with `aria-labelledby` pointing at this heading's id.

  Usage: `<NavHeading text="Library" id="nav-library" />`
-->
<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  /** Props of the heading. */
  interface Props extends HTMLAttributes<HTMLHeadingElement> {
    /** The heading's text, taken from `spec/copy.md`. */
    text: string;
  }

  let { text, class: extra = '', ...rest }: Props = $props();
</script>

<h2 {...rest} class="hs-nav__heading {extra}">{text}</h2>
