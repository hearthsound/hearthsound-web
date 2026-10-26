<!--
  The account menu at the sidebar foot (k26 C, p07b, B05).

  The account row's menu: who is signed in, Customize Home, Account, Connected
  Services, the appearance choice and Sign out. It opens upward from the row; the
  row itself stays the trigger, so the menu's accessible name comes from the
  account rather than from a second button.

  Usage:
  `<AccountMenu bind:open={accountMenu} oncustomize={() => (customizing = true)} />`
-->
<script lang="ts">
  import { session } from '#lib/stores/session.svelte';
  import { appearance } from '#lib/stores/appearance.svelte';
  import type { Scheme } from '#lib/stores/appearance.svelte';
  import { navigate } from '#lib/navigation';
  import AccountRow from '#lib/ui/AccountRow.svelte';
  import Avatar from '#lib/ui/Avatar.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import type { MenuTriggerProps } from '#lib/ui/Menu.svelte';
  import MenuCheckItem from '#lib/ui/MenuCheckItem.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';

  /** Props of the account menu. */
  interface Props {
    /** Whether the menu is open; bindable so the shell closes it on a new page. */
    open?: boolean;
    /** Opens the Customize Home dialog. */
    oncustomize: () => void;
  }

  let { open = $bindable(false), oncustomize }: Props = $props();

  const scheme = $derived(appearance().scheme);

  /**
   * Picks the scheme the menu asks for.
   *
   * @param choice The picked scheme.
   */
  function pickScheme(choice: Scheme): void {
    appearance().set(choice);
  }

  /** Ends the session and returns to the sign-in form. */
  async function signOut(): Promise<void> {
    await session.signOut();
    await navigate('/login');
  }
</script>

<Menu
  label="Account"
  menuLabel="Account"
  align="start"
  class="app-account-menu"
  panelClass="hs-account-menu"
  bind:open
>
  {#snippet trigger(triggerProps: MenuTriggerProps)}
    <AccountRow
      displayName={session.user?.displayName ?? ''}
      expanded={triggerProps['aria-expanded']}
      onclick={triggerProps.onclick}
      class="app-account"
    />
  {/snippet}

  {#if session.user !== null}
    <div class="hs-account-menu__header">
      <Avatar />
      <span class="hs-account-menu__who">
        <span>{session.user.displayName}</span>
        <span>{session.user.username}</span>
      </span>
    </div>
  {/if}
  <MenuSeparator />
  <MenuItem label="Customize Home" icon="adwaita-home" onselect={oncustomize} />
  <MenuItem label="Account" icon="adwaita-account" onselect={() => void navigate('/account')} />
  <MenuItem
    label="Connected Services"
    icon="adwaita-remote"
    onselect={() => void navigate('/account/services')}
  />
  <MenuSeparator />
  <MenuItem label="Appearance" icon="adwaita-dark-mode" submenuLabel="Appearance">
    {#snippet submenu()}
      <MenuCheckItem
        label="System"
        checked={scheme === 'system'}
        onselect={() => pickScheme('system')}
      />
      <MenuCheckItem
        label="Light"
        checked={scheme === 'light'}
        onselect={() => pickScheme('light')}
      />
      <MenuCheckItem label="Dark" checked={scheme === 'dark'} onselect={() => pickScheme('dark')} />
    {/snippet}
  </MenuItem>
  <MenuSeparator />
  <MenuItem label="Sign out" icon="adwaita-sign-out" onselect={signOut} />
</Menu>

<style>
  :global(.app-account-menu) {
    display: flex;
    width: 100%;
  }
</style>
