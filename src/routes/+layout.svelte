<!--
  The application shell.

  One solid grid: the sidebar with the navigation, the search field and the
  account on the left, the main column of the active route on the right, and
  the player bar docked under the content (l01-r1, l04 B). On phones the
  sidebar becomes a 300 px drawer the page header's "Open Navigation" button
  opens, and the player bar becomes the mini card (l01-r1, k35). The toast
  region floats in the content column above the player (l11, l11d).

  The shell also runs the boot sequence once: it asks the server whether it
  needs its first administrator and whether the browser holds a session, and
  shows the route that answers. The sign-in and setup routes draw without the
  shell, because neither has a sidebar or a player (l12-r1, p27).
-->
<script lang="ts">
  import '@hearthsound/design/index.css';
  import favicon from '@hearthsound/design/identity/icons/favicon.svg?url';
  import icon16 from '@hearthsound/design/identity/icons/app-icon-light-16.png?url';
  import icon32 from '@hearthsound/design/identity/icons/app-icon-light-32.png?url';
  import touchIcon from '@hearthsound/design/identity/icons/app-icon-light-180.png?url';
  import { onMount, tick, untrack, type Snippet } from 'svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';

  import NowPlaying from '#lib/components/NowPlaying.svelte';
  import PlayerBar from '#lib/components/PlayerBar.svelte';
  import SidebarNav from '#lib/components/SidebarNav.svelte';
  import ToastStack from '#lib/components/ToastStack.svelte';
  import CustomizeHome from '#lib/home/CustomizeHome.svelte';
  import { HOME_SECTION_BY_ID } from '#lib/home/sections';
  import {
    adminSections,
    administrationEntry,
    librarySections,
    visibleNavSections
  } from '#lib/nav';
  import { navigate } from '#lib/navigation';
  import {
    forgetSearchOrigin,
    rememberSearchOrigin,
    returnFromSearch
  } from '#lib/search-navigation';
  import { setShellNavigation } from '#lib/shell-navigation';
  import { nowPlaying } from '#lib/player/now-playing.svelte';
  import { player } from '#lib/player/player.svelte';
  import { appearance } from '#lib/stores/appearance.svelte';
  import type { Scheme } from '#lib/stores/appearance.svelte';
  import { session } from '#lib/stores/session.svelte';
  import AccountRow from '#lib/ui/AccountRow.svelte';
  import Avatar from '#lib/ui/Avatar.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Lockup from '#lib/ui/Lockup.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import type { MenuTriggerProps } from '#lib/ui/Menu.svelte';
  import MenuCheckItem from '#lib/ui/MenuCheckItem.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';
  import TextField from '#lib/ui/TextField.svelte';

  /** Props of the root layout. */
  interface Props {
    /** Content of the active route, rendered in the main area of the shell. */
    children: Snippet;
  }

  let { children }: Props = $props();

  /** How long typing pauses before the sidebar opens the search results. */
  const SEARCH_DELAY_MS = 300;

  /** What the drawer cycles through while it is open. */
  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  // The stored System / Light / Dark choice applies before the first paint of
  // the shell (the app is client-rendered only).
  appearance();

  const pathname = $derived(page.url.pathname);
  const chromeless = $derived(pathname === '/login' || pathname === '/setup');
  const adminArea = $derived(pathname === '/admin' || pathname.startsWith('/admin/'));

  const context = $derived({
    isAdmin: session.isAdmin,
    systemInfo: session.systemInfo,
    user: session.user
  });

  const library = $derived(visibleNavSections(librarySections, context));
  const administration = $derived(visibleNavSections(adminSections, context));
  const showsAdministration = $derived(
    administrationEntry.visible === undefined || administrationEntry.visible(context)
  );
  const scheme = $derived(appearance().scheme);

  /** Whether the phone drawer covers the page. */
  let drawer = $state(false);

  // Pages that draw a k25 header take the drawer command from the shell and
  // the shell drops its phone bar, so the menu button and the title share one
  // row (l03).
  setShellNavigation({ openNavigation: () => (drawer = true) });

  /** Whether the active page draws its own header with the drawer button. */
  const pageOwnsHeader = $derived(
    ['songs', 'albums', 'artists', 'liked', 'playlists', 'uploads'].some(
      (kind) => pathname === `/library/${kind}`
    ) ||
      pathname === '/' ||
      HOME_SECTION_BY_ID[pathname.replace(/^\/home\//, '')] !== undefined ||
      pathname === '/liked/albums' ||
      pathname === '/liked/artists' ||
      pathname === '/search' ||
      pathname.startsWith('/search/') ||
      pathname.startsWith('/album/') ||
      pathname.startsWith('/artist/') ||
      pathname.startsWith('/playlist/')
  );

  /** Whether the account menu is open. */
  let accountMenu = $state(false);

  /** Whether the Customize Home dialog is open. */
  let customizing = $state(false);

  /** What the sidebar search field holds. */
  let search = $state('');

  /** The last page outside the administration area, for its Library row (b02). */
  let lastLibrary = $state('/');

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let drawerPanel: HTMLDivElement | undefined = $state();

  onMount(async () => {
    const target = await session.boot();
    if (target === null) {
      return;
    }
    if (target === '/login') {
      session.rememberReturnTo(`${page.url.pathname}${page.url.search}`);
    }
    // A browser that already opened the route boot chose stays where it is, so
    // the one-time link's token, which the setup route reads from the query
    // string, is not dropped by a second visit to the same address.
    if (target === page.url.pathname) {
      return;
    }
    await navigate(target, { replaceState: true });
  });

  // The field follows the address both ways: a query typed into the results
  // page's own field reaches this one through `?q=`, and a query typed here
  // reaches that page the same way (l14, p18). The page's write is read
  // without making this effect re-run on every keystroke here.
  $effect(() => {
    const pathname = page.url.pathname;
    const query = page.url.searchParams.get('q') ?? '';
    if (!pathname.startsWith('/search')) {
      return;
    }
    untrack(() => {
      if (search !== query) {
        search = query;
      }
    });
  });

  // Leaving the results page empties the field, so every other page shows the
  // placeholder rather than a query it no longer answers (l14).
  $effect(() => {
    if (!page.url.pathname.startsWith('/search')) {
      untrack(() => {
        if (search !== '') {
          search = '';
        }
      });
    }
  });

  // A new page closes the drawer and the account menu and cancels a search
  // that was waiting on the keyboard. Administration also remembers the page
  // the user left, so its Library row leads back there (b02).
  $effect(() => {
    const path = page.url.pathname;
    untrack(() => {
      drawer = false;
      accountMenu = false;
      clearTimeout(searchTimer);
    });
    if (!path.startsWith('/admin') && path !== '/login' && path !== '/setup') {
      lastLibrary = path;
    }
    if (!path.startsWith('/search')) {
      forgetSearchOrigin();
    }
  });

  // The drawer takes focus when it opens, so the keyboard continues in it.
  $effect(() => {
    if (!drawer) {
      return;
    }
    void tick().then(() => {
      drawerPanel?.querySelector<HTMLElement>(`input, ${FOCUSABLE}`)?.focus();
    });
  });

  /** The visible sidebar search field, if the sidebar is on screen. */
  function sidebarSearchInput(): HTMLInputElement | undefined {
    return Array.from(
      document.querySelectorAll<HTMLInputElement>('.app-search .hs-field__input')
    ).find((field) => field.offsetParent !== null);
  }

  /**
   * Opens the search results for what the field holds.
   *
   * @param event The input event that changed the field.
   */
  function queueSearch(event: Event): void {
    clearTimeout(searchTimer);
    const input = event.currentTarget as HTMLInputElement;
    const text = input.value.trim();
    if (text === '') {
      leaveSearch();
      return;
    }
    const fromDrawer = input.closest('.hs-drawer') !== null;
    searchTimer = setTimeout(() => {
      void openSearch(text, fromDrawer);
    }, SEARCH_DELAY_MS);
  }

  /**
   * Replaces the content column with the search results (l14).
   *
   * A navigation resets focus to the page, so the field that was being typed
   * in takes it back: the sidebar's own field on desktop, and on phones the
   * results page's field once the drawer closes over it.
   *
   * @param text The query to search for.
   * @param fromDrawer Whether the phone drawer held the field.
   */
  async function openSearch(text: string, fromDrawer: boolean): Promise<void> {
    const route = `/search?q=${encodeURIComponent(text)}`;
    // The results take over the content column, so the drawer gets out of
    // their way on phones.
    drawer = false;
    if (page.url.pathname.startsWith('/search')) {
      await navigate(route, { replaceState: true });
    } else {
      rememberSearchOrigin(page.url.pathname);
      await navigate(route);
    }
    void tick().then(() => {
      const field = fromDrawer
        ? document.querySelector<HTMLInputElement>('.hs-page input[type="search"]')
        : sidebarSearchInput();
      field?.focus();
    });
  }

  /** Returns from the results page to the page they were opened from (p18). */
  function leaveSearch(): void {
    clearTimeout(searchTimer);
    search = '';
    if (page.url.pathname.startsWith('/search')) {
      returnFromSearch();
    }
  }

  /**
   * Escape in the sidebar field returns from the results, even when the field
   * is already empty (b01). Elsewhere the field's own clear-and-blur applies.
   *
   * @param event The key press.
   */
  function searchKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape' || page.url.pathname !== '/search') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    leaveSearch();
  }

  /** Puts the cursor in the sidebar search field, opening the drawer on phones (b01). */
  function focusSearch(): void {
    const visible = sidebarSearchInput();
    if (visible !== undefined) {
      visible.focus();
      visible.select();
      return;
    }
    drawer = true;
    void tick().then(() => {
      drawerPanel?.querySelector<HTMLElement>(`input, ${FOCUSABLE}`)?.focus();
    });
  }

  /** Closes the drawer and returns focus to its trigger. */
  function closeDrawer(): void {
    drawer = false;
    document
      .querySelector<HTMLButtonElement>('.hs-page-header__menu, .shell-phone-bar .hs-button')
      ?.focus();
  }

  /**
   * Handles the shell's global keys: "/" focuses search and Space toggles play.
   *
   * @param event The key press.
   */
  function onKeydown(event: KeyboardEvent): void {
    if (!session.ready || chromeless || event.defaultPrevented) {
      return;
    }
    const target = event.target;
    const typing =
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT');
    if (event.key === 'Escape' && drawer && !typing) {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (drawer && event.key === 'Tab') {
      trapDrawer(event);
      return;
    }
    if (typing || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    if (event.key === 'Escape' && page.url.pathname === '/search') {
      event.preventDefault();
      leaveSearch();
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      focusSearch();
      return;
    }
    if (
      event.key === ' ' &&
      player.queue.current !== null &&
      target instanceof HTMLElement &&
      target.closest(
        'button, a, input, textarea, select, [role="button"], [role="slider"], [role="menuitem"], [role="menuitemradio"], [contenteditable="true"]'
      ) === null
    ) {
      event.preventDefault();
      player.toggle();
    }
  }

  /**
   * Keeps Tab inside the open drawer until it closes.
   *
   * @param event The Tab press.
   */
  function trapDrawer(event: KeyboardEvent): void {
    if (drawerPanel === undefined) {
      return;
    }
    const focusable = Array.from(drawerPanel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (element) => element.offsetParent !== null
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    const outside = !(active instanceof Node) || !drawerPanel.contains(active);
    if (event.shiftKey && (outside || active === first)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (outside || active === last)) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Ends the session and returns to the sign-in form. */
  async function signOut(): Promise<void> {
    await session.signOut();
    await navigate('/login');
  }

  /**
   * Picks the scheme the account menu asks for.
   *
   * @param choice The picked scheme.
   */
  function pickScheme(choice: Scheme): void {
    appearance().set(choice);
  }
</script>

<svelte:head>
  <title>Hearthsound</title>
  <link rel="icon" type="image/svg+xml" href={favicon} />
  <link rel="icon" type="image/png" sizes="32x32" href={icon32} />
  <link rel="icon" type="image/png" sizes="16x16" href={icon16} />
  <link rel="apple-touch-icon" href={touchIcon} />
  <link rel="manifest" href={resolve('/manifest.webmanifest')} />
</svelte:head>

<svelte:window onkeydown={onKeydown} />

{#snippet sidebar(inDrawer: boolean)}
  <div class="hs-sidebar app-sidebar-pane" class:hs-sidebar--drawer={inDrawer}>
    <div class="app-sidebar-scroll">
      <!-- The lockup is the Home link (brand-home); its text names the link. -->
      <Lockup href={resolve('/')} />

      {#if !adminArea}
        <TextField
          class="app-search"
          kind="search"
          sidebar
          label="Search"
          placeholder="Song, album or artist"
          bind:value={search}
          oninput={queueSearch}
          onclear={leaveSearch}
          onkeydown={searchKey}
        />
      {/if}

      <SidebarNav
        {adminArea}
        {pathname}
        sections={adminArea ? administration : library}
        backHref={lastLibrary}
        administration={!adminArea && showsAdministration ? administrationEntry : null}
        openNowPlaying={() => nowPlaying.open()}
      />
    </div>

    <div class="app-sidebar-foot">
      {#if session.user !== null}
        <Menu
          label="Account"
          menuLabel="Account"
          align="start"
          class="app-account-menu"
          panelClass="hs-account-menu"
          bind:open={accountMenu}
        >
          {#snippet trigger(triggerProps: MenuTriggerProps)}
            <AccountRow
              displayName={session.user?.displayName ?? ''}
              expanded={triggerProps['aria-expanded']}
              onclick={triggerProps.onclick}
              class="app-account"
            />
          {/snippet}

          <div class="hs-account-menu__header">
            <Avatar />
            <span class="hs-account-menu__who">
              <span>{session.user.displayName}</span>
              <span>{session.user.username}</span>
            </span>
          </div>
          <MenuSeparator />
          <MenuItem
            label="Customize Home"
            icon="adwaita-home"
            onselect={() => (customizing = true)}
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
              <MenuCheckItem
                label="Dark"
                checked={scheme === 'dark'}
                onselect={() => pickScheme('dark')}
              />
            {/snippet}
          </MenuItem>
          <MenuSeparator />
          <MenuItem label="Sign out" icon="adwaita-sign-out" onselect={signOut} />
        </Menu>
      {/if}
    </div>
  </div>
{/snippet}

{#if chromeless}
  {@render children()}
{:else if session.ready}
  <div class="hs-shell">
    <aside class="hs-shell__sidebar">
      {@render sidebar(false)}
    </aside>

    <main class="hs-shell__main">
      {#if !pageOwnsHeader}
        <div class="shell-phone-bar">
          <Button
            variant="flat"
            shape="icon"
            icon="adwaita-menu"
            label="Open Navigation"
            onclick={() => (drawer = true)}
          />
        </div>
      {/if}

      <div class="hs-page" class:hs-page--home={pathname === '/'}>
        {@render children()}
      </div>
    </main>

    <div class="hs-shell__player" role="region" aria-label="Player">
      <PlayerBar />
    </div>
  </div>

  {#if nowPlaying.opened}
    <NowPlaying />
  {/if}

  {#if customizing}
    <CustomizeHome close={() => (customizing = false)} />
  {/if}

  {#if drawer}
    <button
      class="hs-scrim hs-scrim--drawer shell-drawer-scrim"
      type="button"
      aria-label="Close Navigation"
      onclick={closeDrawer}
    ></button>
    <div
      class="hs-drawer"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
      bind:this={drawerPanel}
    >
      {@render sidebar(true)}
    </div>
  {/if}

  <div class="hs-overlay-dock">
    <ToastStack />
  </div>
{/if}

<style>
  /* The sidebar is a flex column whose list scrolls; its foot stays pinned so
     the account menu can open above the row without being clipped (k26). */
  /* Until every page carries its own l09/l10 paddings, the shell keeps the
     content off the sidebar and the window edge. */
  .hs-page {
    /* The page is the containing block of the small absolutely positioned
       labels its content carries (the section headers' "See all" text). Without
       it they position against the document and stretch it past the window,
       which turns the whole shell into one scrolled page. */
    position: relative;
    padding: 0 var(--hs-space-6);
  }

  /* Home owns its own insets: the approved shelf header and rows sit 32 px from
     the view edge and the page title 24 px, so the page hands the column over
     unpadded and Home puts the header on its margin. */
  .hs-page--home {
    padding: 0;
  }

  @media (max-width: 720px) {
    .hs-page {
      padding: 0 var(--hs-space-5);
    }
  }

  .app-sidebar-pane {
    gap: 0;
    overflow: visible;
  }

  .app-sidebar-scroll {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: var(--hs-space-1);
    min-height: 0;
  }

  .app-sidebar-foot {
    display: flex;
    flex: none;
    flex-direction: column;
    gap: var(--hs-space-1);
    padding-top: var(--hs-space-1);
  }

  :global(.app-account-menu) {
    display: flex;
    width: 100%;
  }

  .shell-phone-bar {
    display: none;
  }

  /* The drawer trigger leads the phone page header (l01-r1, c02). */
  @media (max-width: 720px) {
    .shell-phone-bar {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      height: calc(var(--hs-space-6) + var(--hs-space-7));
      padding: 0 var(--hs-space-5);
      background: var(--hs-view-bg);
    }
  }

  .shell-drawer-scrim {
    padding: 0;
    border: 0;
    cursor: default;
  }
</style>
