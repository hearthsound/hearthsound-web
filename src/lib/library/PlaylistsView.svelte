<!--
  The Playlists library view (o04, E9).

  The playlists the caller may see, in the l08 card grid, each card showing a
  mosaic of its first four covers. Play queues the whole playlist through the
  server's collection queue (queue-api); a cover read that fails leaves the
  card without a mosaic instead of taking the view down. The header's New
  Playlist action opens the k19 dialog and visits the new playlist. A changed
  playlist reads the list again.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import { KIND_TITLES } from '#lib/library/kinds';
  import LoadFailure from '#lib/library/LoadFailure.svelte';
  import PlaylistDialog from '#lib/library/PlaylistDialog.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import { navigate } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { coverArtUrl } from '#lib/player/stream';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { events } from '#lib/stores/events.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { Playlist } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import CardPlaceholders from '#lib/ui/CardPlaceholders.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import PlaylistCard from '#lib/ui/PlaylistCard.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  const shell = getShellNavigation();

  const title = KIND_TITLES.playlists;

  let playlists = $state<Playlist[]>([]);
  let playlistCovers = $state<Record<string, string[]>>({});
  let loading = $state(true);
  let failure = $state<string | null>(null);
  let creating = $state(false);

  /** The grid, which the placeholders measure. */
  let playlistGrid = $state<HTMLDivElement>();

  onMount(() => {
    void load();
    return events.on('playlist.changed', () => {
      void load();
    });
  });

  /** Reads the playlists and the covers their cards show. */
  async function load(): Promise<void> {
    loading = true;
    failure = null;
    playlistCovers = {};
    try {
      const answer = await libraryApi.playlists();
      playlists = answer;
      const covers = await Promise.all(
        answer.map(async (playlist) => {
          try {
            const full = await libraryApi.playlist(playlist.id);
            const entries = full?.entry ?? [];
            const ids = entries
              .map((entry) => entry.coverArt)
              .filter((id): id is string => id !== undefined && id !== '');
            return [playlist.id, ids.slice(0, 4).map((id) => coverArtUrl(id, 300))] as const;
          } catch {
            return [
              playlist.id,
              playlist.coverArt === undefined ? [] : [coverArtUrl(playlist.coverArt, 300)]
            ] as const;
          }
        })
      );
      playlistCovers = Object.fromEntries(covers);
    } catch (error) {
      failure = error instanceof Error ? error.message : 'The list could not be read.';
    } finally {
      loading = false;
    }
  }

  /**
   * Opens the playlist that was just created.
   *
   * @param playlist The new playlist.
   */
  async function openPlaylist(playlist: Playlist): Promise<void> {
    creating = false;
    await navigate(`/playlist/${playlist.id}`);
  }

  /**
   * Queues one of the playlist cards.
   *
   * @param playlist The playlist to play.
   */
  async function playPlaylist(playlist: Playlist): Promise<void> {
    try {
      const collection = await loadCollection(`playlist:${playlist.id}`);
      if (collection === null || collection.items.length === 0) {
        return;
      }
      player.play(collection.items, collection.startIndex);
    } catch {
      // A cover read failure must not take the view down; the card simply
      // does not play.
    }
  }
</script>

<svelte:head>
  <title>{title} - Hearthsound</title>
</svelte:head>

{#snippet headerActions()}
  <Button header icon="adwaita-add" label="New Playlist" onclick={() => (creating = true)}>
    New Playlist
  </Button>
{/snippet}

<PageHeader
  {title}
  class="library-header"
  onnavigation={shell?.openNavigation}
  actions={failure === null ? headerActions : undefined}
/>

{#if failure !== null}
  <LoadFailure retry={() => void load()} />
{:else if loading}
  <div class="loading" aria-busy="true">
    <span class="hs-visually-hidden" role="status">Loading...</span>
    <div class="hs-card-grid cards" bind:this={playlistGrid}>
      <CardPlaceholders items={0} grid={playlistGrid} rows={2} />
    </div>
  </div>
{:else if playlists.length === 0}
  <StatusPage
    level={2}
    icon="adwaita-playlist"
    title="No Playlists Yet"
    text="Playlists you create show up here."
  />
{:else}
  <div class="hs-card-grid cards">
    {#each playlists as playlist (playlist.id)}
      <PlaylistCard
        name={playlist.name}
        songs={playlist.songCount ?? 0}
        href={`/playlist/${playlist.id}`}
        covers={playlistCovers[playlist.id] ?? []}
        onplay={() => void playPlaylist(playlist)}
      />
    {/each}
  </div>
{/if}

{#if creating}
  <PlaylistDialog created={openPlaylist} close={() => (creating = false)} />
{/if}

<style>
  .cards {
    padding: var(--hs-space-3) 0 var(--hs-space-7);
  }

  /* The loading state lays its placeholders in the loaded state's own grid and
     padding, so the title's gap and the scroll position do not move when the
     read finishes. */
  .loading {
    display: contents;
  }

  @media (max-width: 720px) {
    .cards {
      padding-bottom: var(--hs-space-6);
    }
  }
</style>
