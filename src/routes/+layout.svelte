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

  A member who opens an administration address keeps the library sidebar; the
  guard's status page explains the refusal.
-->
<script module lang="ts">
  /**
   * The id of the account the entity seeds and membership marks belong to.
   *
   * Module scope rather than instance scope: it names what the stores hold, and
   * the stores outlive a mount of the shell.
   */
  let knownUser: string | null = null;
</script>

<script lang="ts">
  import '@hearthsound/design/index.css';
  import favicon from '@hearthsound/design/identity/icons/favicon.svg?url';
  import icon16 from '@hearthsound/design/identity/icons/app-icon-light-16.png?url';
  import icon32 from '@hearthsound/design/identity/icons/app-icon-light-32.png?url';
  import touchIcon from '@hearthsound/design/identity/icons/app-icon-light-180.png?url';
  import { onMount, tick, untrack, type Snippet } from 'svelte';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';

  import AccountMenu from '#lib/components/AccountMenu.svelte';
  import Drawer from '#lib/components/Drawer.svelte';
  import NowPlaying from '#lib/components/NowPlaying.svelte';
  import PlayerBar from '#lib/components/PlayerBar.svelte';
  import SidebarNav from '#lib/components/SidebarNav.svelte';
  import ToastStack from '#lib/components/ToastStack.svelte';
  import CustomizeHome from '#lib/home/CustomizeHome.svelte';
  import { membership } from '#lib/library/membership.svelte';
  import {
    adminSections,
    administrationEntry,
    librarySections,
    visibleNavSections
  } from '#lib/nav';
  import { navContext } from '#lib/nav-context';
  import { navigate } from '#lib/navigation';
  import { installTargetCapture } from '#lib/paths';
  import {
    forgetSearchOrigin,
    rememberSearchOrigin,
    returnFromSearch
  } from '#lib/search-navigation';
  import { SearchField } from '#lib/search-field.svelte';
  import { routeMetadata } from '#lib/routes';
  import { setShellNavigation } from '#lib/shell-navigation';
  import { nowPlaying } from '#lib/player/now-playing.svelte';
  import { player } from '#lib/player/player.svelte';
  import { appearance } from '#lib/stores/appearance.svelte';
  import { connection } from '#lib/stores/connection.svelte';
  import { entities } from '#lib/stores/entities';
  import { session } from '#lib/stores/session.svelte';
  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Lockup from '#lib/ui/Lockup.svelte';
  import Spinner from '#lib/ui/Spinner.svelte';
  import TextField from '#lib/ui/TextField.svelte';

  /** Props of the root layout. */
  interface Props {
    /** Content of the active route, rendered in the main area of the shell. */
    children: Snippet;
  }

  let { children }: Props = $props();

  /** How long typing pauses before the sidebar opens the search results. */
  const SEARCH_DELAY_MS = 300;

  // The stored System / Light / Dark choice applies before the first paint of
  // the shell (the app is client-rendered only).
  appearance();

  const pathname = $derived(page.url.pathname);
  const chromeless = $derived(pathname === '/login' || pathname === '/setup');
  const adminArea = $derived(
    session.isAdmin && (pathname === '/admin' || pathname.startsWith('/admin/'))
  );

  const context = $derived(navContext(session));

  const library = $derived(visibleNavSections(librarySections, context));
  const administration = $derived(
    session.isAdmin ? visibleNavSections(adminSections, context) : []
  );
  const showsAdministration = $derived(
    administrationEntry.visible === undefined || administrationEntry.visible(context)
  );

  /** Whether the phone drawer covers the page. */
  let drawer = $state(false);

  // Pages that draw a k25 header take the drawer command from the shell and
  // the shell drops its phone bar, so the menu button and the title share one
  // row (l03). The route registry decides which pages those are (l01-r1).
  setShellNavigation({ openNavigation: () => (drawer = true) });

  /** Whether the active page draws its own header with the drawer button. */
  const pageOwnsHeader = $derived(routeMetadata(pathname).ownsHeader);

  /**
   * Whether the sidebar's account menu is open. The phone drawer draws a
   * second sidebar whose menu has its own state: shared, the hidden sidebar's
   * menu took every press inside the drawer's menu as an outside click and
   * closed both.
   */
  let accountMenu = $state(false);

  /** Whether the phone drawer's account menu is open. */
  let drawerAccountMenu = $state(false);

  /** Whether the Customize Home dialog is open. */
  let customizing = $state(false);

  /** The sidebar search field and its tie to the address's query. */
  const search = new SearchField();

  /** The last page outside the administration area, for its Library row (b02). */
  let lastLibrary = $state('/');

  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  // A click on a card carries the entity's id; remembering it here is what lets
  // the page it opens read that entity without resolving its path again.
  onMount(() => installTargetCapture());

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
    await navigate(target, { replace: true });
  });

  // The field follows the address both ways: a query typed into the results
  // page's own field reaches this one through `?q=`, and a query typed here
  // reaches that page the same way (l14, p18). Leaving the results empties the
  // field, so every other page shows the placeholder rather than a query it no
  // longer answers. The sync watches the address once; the field's own writes
  // do not make this effect re-run on every keystroke here.
  $effect(() => {
    const path = page.url.pathname;
    const query = page.url.searchParams.get('q') ?? '';
    untrack(() => {
      if (path.startsWith('/search')) {
        search.adopt(query);
      } else {
        search.clear();
      }
    });
  });

  // A new page closes the drawer and the account menu and cancels a search
  // that was waiting on the keyboard. Administration also remembers the page
  // the user left, so its Library row leads back there (b02).
  // What one account's cards taught the session is not another account's: the
  // seeds and the membership marks go whenever the signed-in user changes,
  // including an account switch that never passed through a signed-out moment.
  $effect(() => {
    const id = session.user?.id ?? null;
    if (id !== knownUser) {
      knownUser = id;
      untrack(() => {
        entities.clear();
        membership.reset();
      });
    }
  });

  $effect(() => {
    const path = page.url.pathname;
    untrack(() => {
      drawer = false;
      accountMenu = false;
      drawerAccountMenu = false;
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
  // Drawer.svelte owns that, along with the focus trap.

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
   * The sidebar's field stays on screen across the navigation, so it keeps
   * focus and the user types on without interruption. On phones the drawer
   * closes over the results, so the results page's own field takes focus once
   * it is there.
   *
   * @param text The query to search for.
   * @param fromDrawer Whether the phone drawer held the field.
   */
  async function openSearch(text: string, fromDrawer: boolean): Promise<void> {
    const route = `/search?q=${encodeURIComponent(text)}`;
    // The results take over the content column, so the drawer gets out of
    // their way on phones.
    drawer = false;
    // The sidebar field stays on screen: the navigation must neither blur it
    // nor move focus, or the next keystroke is lost.
    const reset = fromDrawer;
    if (page.url.pathname.startsWith('/search')) {
      await navigate(route, { replace: true, reset });
    } else {
      rememberSearchOrigin(page.url.pathname);
      await navigate(route, { reset });
    }
    if (fromDrawer) {
      await tick();
      document.querySelector<HTMLInputElement>('.hs-page input[type="search"]')?.focus();
    }
  }

  /** Returns from the results page to the page they were opened from (p18). */
  function leaveSearch(): void {
    clearTimeout(searchTimer);
    search.clear();
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
    // The drawer focuses its first field (the search field) when it opens.
    drawer = true;
  }

  /** Closes the drawer and returns focus to its trigger. */
  function closeDrawer(): void {
    drawer = false;
    drawerAccountMenu = false;
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
    if (typing || event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }
    // The drawer owns its Escape, so it closes before the results page's own
    // Escape returns from the search.
    if (drawer && event.key === 'Escape') {
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
          bind:value={search.value}
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
        {#if inDrawer}
          <AccountMenu bind:open={drawerAccountMenu} oncustomize={() => (customizing = true)} />
        {:else}
          <AccountMenu bind:open={accountMenu} oncustomize={() => (customizing = true)} />
        {/if}
      {/if}
    </div>
  </div>
{/snippet}

{#if !session.ready}
  <!-- p27: the plain l12 frame while the session is unknown: lockup and a
       48 px spinner, no text. -->
  <div class="hs-onboarding">
    <div class="hs-onboarding__top">
      <Lockup />
    </div>
    <div class="hs-onboarding__body hs-booting">
      <Spinner size={48} />
    </div>
  </div>
{:else if chromeless}
  {@render children()}
{:else}
  <!-- l11b: the floating layer sits before the content in DOM order; the
       package's column-reverse puts the banner on the player edge. -->
  <div class="hs-overlay-dock">
    {#if connection.unreachable}
      <Banner level="error" floating role="alert" text="Server unreachable. Trying again...">
        {#snippet actions()}
          <Button onclick={() => void connection.retry()}>Retry</Button>
        {/snippet}
      </Banner>
    {/if}
    <ToastStack />
  </div>

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
    <Drawer open={drawer} onclose={closeDrawer}>
      {@render sidebar(true)}
    </Drawer>
  {/if}
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
</style>
