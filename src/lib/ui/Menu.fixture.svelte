<!--
  Menu content for the menu's component tests.

  Not part of the app: it gives the tests a menu of real MenuItems, a menu with
  feature content that opts into the item contract, and a menu with a cascading
  submenu, without repeating the markup in every test.
-->
<script lang="ts">
  import Menu from './Menu.svelte';
  import MenuItem from './MenuItem.svelte';

  /** Props of the fixture. */
  interface Props {
    /** Which menu content to draw. */
    variant: 'plain' | 'feature' | 'submenu';
  }

  let { variant }: Props = $props();
</script>

<Menu label="Actions" menuLabel="Actions">
  {#if variant === 'plain'}
    <MenuItem label="One" />
    <MenuItem label="Two" />
    <MenuItem label="Three" />
  {:else if variant === 'feature'}
    <MenuItem label="Queue" />
    <div class="row">
      <button data-menu-item tabindex="-1" aria-label="Like" type="button">Like</button>
    </div>
    <MenuItem label="Album" />
  {:else}
    <MenuItem label="Appearance" submenuLabel="Appearance">
      {#snippet submenu()}
        <MenuItem label="Dark" />
      {/snippet}
    </MenuItem>
  {/if}
</Menu>
