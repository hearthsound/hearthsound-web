<!--
  The system status pages (p27, k22).

  A route SvelteKit could not answer draws one of the approved status pages
  inside the app shell: the sidebar and the player stay, so the browser keeps
  its place. Status 404 is "Page Not Found"; status 403, which the
  administration guard raises for a member, is "Not Allowed". The document
  title follows the state with the E4 suffix.

  The specification names these two statuses only; any other error keeps the
  not-found surface rather than inventing copy.
-->
<script lang="ts">
  import { page } from '$app/state';

  import { navigate } from '#lib/navigation';
  import Button from '#lib/ui/Button.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  /** Props SvelteKit passes to an error page. */
  interface Props {
    /**
     * The error the boundary caught. A `load` failure also reports its status
     * through `page`; a component that raised one carries it here.
     */
    error?: unknown;
  }

  let { error }: Props = $props();

  /**
   * Reads the HTTP status off a caught value.
   *
   * @param caught The value the error page was rendered for.
   * @returns The status it carries, or `null` when it has none.
   */
  function statusOf(caught: unknown): number | null {
    if (typeof caught !== 'object' || caught === null || !('status' in caught)) {
      return null;
    }
    const status = caught.status;
    return typeof status === 'number' ? status : null;
  }

  const forbidden = $derived((statusOf(error) ?? page.status) === 403);

  /** Jumps to the client's home. */
  function goHome(): void {
    void navigate('/');
  }
</script>

<svelte:head>
  <title>{forbidden ? 'Not Allowed' : 'Page Not Found'} - Hearthsound</title>
</svelte:head>

{#snippet homeAction()}
  <Button onclick={goHome}>Go Home</Button>
{/snippet}

<!-- Layout glue only: k22 fills a flex parent, while the shell's main column
     is a scrolling block; the wrapper supplies the content-area height (the
     player bar is 88 px, the phone bar and mini player 128 px). -->
<div class="system-state">
  {#if forbidden}
    <StatusPage
      alert
      icon="adwaita-lock"
      title="Not Allowed"
      text="This page is for administrators."
      action={homeAction}
    />
  {:else}
    <StatusPage
      alert
      icon="adwaita-search"
      title="Page Not Found"
      text="This address does not match any page."
      action={homeAction}
    />
  {/if}
</div>

<style>
  .system-state {
    display: flex;
    min-height: calc(100dvh - 88px);
  }

  @media (max-width: 720px) {
    .system-state {
      min-height: calc(100dvh - 128px);
    }
  }
</style>
