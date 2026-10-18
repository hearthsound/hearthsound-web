<script lang="ts">
  import type { Snippet } from 'svelte';

  import '../app.css';

  /** Props of the root layout. */
  interface Props {
    /** Content of the active route, rendered in the main area of the shell. */
    children: Snippet;
  }

  let { children }: Props = $props();
</script>

<svelte:head>
  <title>Hearthsound</title>
</svelte:head>

<div class="app-shell">
  <aside class="app-sidebar">
    <nav class="app-nav" aria-label="Main"></nav>
    <div class="app-sidebar-footer"></div>
  </aside>

  <main class="app-main">
    {@render children()}
  </main>

  <div class="app-player" role="region" aria-label="Player"></div>

  <div class="app-toasts" role="status" aria-label="Notifications"></div>
</div>
