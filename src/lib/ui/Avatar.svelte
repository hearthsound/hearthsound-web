<!--
  The account avatar (k26 C).

  A 32 px circle on the control tone with the person glyph. It is decorative:
  the account row that holds it carries the accessible name.

  Usage: `<Avatar />`
-->
<script lang="ts">
  import type { HTMLAttributes } from 'svelte/elements';

  import Icon from './Icon.svelte';

  /** Props of the avatar. */
  interface Props extends HTMLAttributes<HTMLSpanElement> {
    /** Extra classes for the wrapper. */
    class?: string;
  }

  let { class: extra = '', ...rest }: Props = $props();
</script>

<span {...rest} class="hs-avatar {extra}" aria-hidden="true">
  <Icon name="adwaita-account" />
</span>
