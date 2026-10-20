<!--
  The account row at the sidebar foot (k26 C, p07b).

  A menu button with the avatar and the display name; it keeps its pressed tone
  while the account menu is open, driven by `aria-expanded`. The menu itself
  (Customize Home, Appearance, Sign out) opens upward from this row.

  Usage:
  ```
  <AccountRow displayName={user.displayName} expanded={menuOpen} onclick={toggleMenu} />
  ```
-->
<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import Avatar from './Avatar.svelte';

  /** Props of the row. */
  interface Props extends Omit<HTMLButtonAttributes, 'onclick' | 'aria-label'> {
    /** The name shown beside the avatar and heard after "Account". */
    displayName: string;
    /** Whether the account menu is open. */
    expanded: boolean;
    /** Opens or closes the account menu. */
    onclick: (event: MouseEvent) => void;
  }

  let {
    displayName,
    expanded,
    onclick,
    type = 'button',
    class: extra = '',
    ...rest
  }: Props = $props();
</script>

<button
  {...rest}
  {type}
  class="hs-account {extra}"
  aria-haspopup="menu"
  aria-expanded={expanded}
  aria-label="Account, {displayName}"
  {onclick}
>
  <Avatar />
  <span class="hs-account__name">{displayName}</span>
</button>
