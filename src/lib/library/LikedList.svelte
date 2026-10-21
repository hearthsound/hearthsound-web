<!--
  A Liked full list (o04, E8).

  The Liked shelves' titles open one of these pages: the shelf's items in the
  l08 card grid, the l03 back button in the header, the page type's empty state,
  the o03 status page on a failed read and "Loading..." placeholders while the
  read runs. The grid is not paged: the liked answer carries every entity.
-->
<script lang="ts">
  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import type { IconName } from '@hearthsound/design/icons';
  import { canUpload } from '#lib/nav';
  import { navigate } from '#lib/navigation';
  import { events } from '#lib/stores/events.svelte';
  import { session } from '#lib/stores/session.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { AlbumID3, ArtistID3 } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import { onMount } from 'svelte';

  /** Props of a liked full list. */
  interface Props {
    /** Which liked entities the page lists. */
    kind: 'albums' | 'artists';
  }

  let { kind }: Props = $props();

  const title = $derived(kind === 'albums' ? 'Liked Albums' : 'Liked Artists');

  let albums = $state<AlbumID3[]>([]);
  let artists = $state<ArtistID3[]>([]);
  let loading = $state(true);
  let failure = $state<string | null>(null);

  const mayUpload = $derived(
    canUpload({
      isAdmin: session.isAdmin,
      systemInfo: session.systemInfo,
      user: session.user
    })
  );

  const empty: { icon: IconName; heading: string; text: string } = $derived(
    kind === 'albums'
      ? {
          icon: 'adwaita-album',
          heading: 'No Albums Yet',
          text: 'Albums with songs in your library show up here.'
        }
      : {
          icon: 'adwaita-artist',
          heading: 'No Artists Yet',
          text: 'Artists with songs in your library show up here.'
        }
  );

  onMount(() => {
    void load();
    return events.on('library.changed', () => {
      void load();
    });
  });

  /** Reads the liked entities this page lists. */
  async function load(): Promise<void> {
    loading = true;
    failure = null;
    try {
      const answer = await libraryApi.starred();
      albums = answer.album ?? [];
      artists = answer.artist ?? [];
    } catch (error) {
      failure = error instanceof Error ? error.message : 'The list could not be read.';
    } finally {
      loading = false;
    }
  }

  /** Returns to the page that opened this list. */
  function back(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      void navigate('/library/liked');
    }
  }
</script>

<svelte:head>
  <title>{title} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load()}>Retry</Button>
{/snippet}

{#snippet uploadAction()}
  <Button icon="custom-upload" onclick={() => void navigate('/library/uploads')}>
    Upload Songs
  </Button>
{/snippet}

<PageHeader {title} class="liked-list-header" onback={back} />

{#if failure !== null}
  <StatusPage
    level={2}
    alert
    icon="adwaita-error"
    title="Could Not Load This Page"
    text="The server did not answer. Try again in a moment."
    action={retryAction}
  />
{:else if loading}
  <div class="loading" aria-busy="true">
    <span class="hs-visually-hidden" role="status">Loading...</span>
    <div class="hs-card-grid">
      {#each [...Array(8).keys()] as key (key)}
        <div class="hs-card">
          <span class="hs-card__cover">
            <Skeleton width="100%" height="100%" radius="art" />
          </span>
          <span class="hs-card__text">
            <Skeleton width="80%" height="14px" />
            <Skeleton width="50%" height="13px" />
          </span>
        </div>
      {/each}
    </div>
  </div>
{:else if (kind === 'albums' ? albums : artists).length === 0}
  <StatusPage
    level={2}
    icon={empty.icon}
    title={empty.heading}
    text={empty.text}
    action={mayUpload ? uploadAction : undefined}
  />
{:else}
  <div class="hs-card-grid cards">
    {#if kind === 'albums'}
      {#each albums as album (album.id)}
        <AlbumCard {album} />
      {/each}
    {:else}
      {#each artists as artist (artist.id)}
        <ArtistCard {artist} />
      {/each}
    {/if}
  </div>
{/if}

<style>
  /* Layout glue only: the shell holds the page off the window edge. */
  :global(.liked-list-header) {
    padding-inline: 0;
  }

  .cards {
    padding: var(--hs-space-3) 0 var(--hs-space-7);
  }

  .loading {
    padding-bottom: var(--hs-space-6);
  }
</style>
