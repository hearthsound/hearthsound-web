<!--
  The application shell: the sidebar with the navigation and the account, the
  main area of the active route, the player bar and the toast stack.

  The shell runs the boot sequence once: it asks the server whether it needs its
  first administrator and whether the browser holds a session, and shows the
  route that answers. Until then the main area stays empty, so nothing flashes
  before the client knows who it is.
-->
<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';

  import PlayerBar from '#lib/components/PlayerBar.svelte';
  import ToastStack from '#lib/components/ToastStack.svelte';
  import { navSections, visibleNavSections } from '#lib/nav';
  import { clientRoute, navigate } from '#lib/navigation';
  import { session } from '#lib/stores/session.svelte';

  /** Props of the root layout. */
  interface Props {
    /** Content of the active route, rendered in the main area of the shell. */
    children: Snippet;
  }

  let { children }: Props = $props();

  const sections = $derived(
    visibleNavSections(navSections, {
      isAdmin: session.isAdmin,
      systemInfo: session.systemInfo
    })
  );

  onMount(async () => {
    const target = await session.boot();
    if (target === null) {
      return;
    }
    if (target === '/login') {
      session.rememberReturnTo(`${page.url.pathname}${page.url.search}`);
    }
    await navigate(target, { replaceState: true });
  });

  /** Ends the session and returns to the sign-in form. */
  async function signOut(): Promise<void> {
    await session.signOut();
    await navigate('/login');
  }
</script>

<svelte:head>
  <title>Hearthsound</title>
</svelte:head>

<div class="app-shell">
  <aside class="app-sidebar">
    <p class="app-brand">Hearthsound</p>

    <nav class="app-nav" aria-label="Main">
      {#each sections as section (section.title ?? section.entries[0].href)}
        {#if section.title !== undefined}
          <h2 class="app-nav-title">{section.title}</h2>
        {/if}
        <ul class="app-nav-list">
          {#each section.entries as entry (entry.href)}
            <li>
              <a class="app-nav-link" href={resolve(clientRoute(entry.href))}>{entry.label}</a>
            </li>
          {/each}
        </ul>
      {/each}
    </nav>

    <div class="app-sidebar-footer">
      {#if session.user !== null}
        <p class="app-account">{session.user.displayName}</p>
        <button class="app-sign-out" type="button" onclick={signOut}>Sign out</button>
      {/if}
    </div>
  </aside>

  <main class="app-main">
    {#if session.ready}
      {@render children()}
    {/if}
  </main>

  <div class="app-player" role="region" aria-label="Player">
    <PlayerBar />
  </div>

  <div class="app-toasts" role="status" aria-label="Notifications">
    <ToastStack />
  </div>
</div>

<style>
  .app-brand {
    margin: 0;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .app-nav-title {
    margin: var(--space-3) 0 var(--space-1);
    color: var(--color-fg-muted);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .app-nav-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .app-nav-link {
    display: block;
    padding: var(--space-1) 0;
    color: var(--color-fg);
    text-decoration: none;
  }

  .app-nav-link:hover {
    color: var(--color-accent);
  }

  .app-account {
    margin: 0 0 var(--space-2);
  }

  .app-sign-out {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }
</style>
