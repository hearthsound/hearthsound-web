<!--
  The Liked library view (o04, E9).

  The caller's liked albums and artists as two shelves that link to their full
  lists, then the liked songs as k12 rows (k12). A like, an unsave or an upload
  changes what the view holds, so `library.changed` reads it again. An empty
  library shows the p08e empty state without an upload action: liking is the
  only way into this view.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { KIND_TITLES, LIBRARY_KIND_INFO } from '#lib/library/kinds';
  import { firstPagePlaceholders } from '#lib/library/placeholders';
  import LoadFailure from '#lib/library/LoadFailure.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import type { QueueSource } from '#lib/library/queue-source';
  import TrackRowPlaceholders from '#lib/library/TrackRowPlaceholders.svelte';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { availability } from '#lib/stores/availability.svelte';
  import { events } from '#lib/stores/events.svelte';
  import { libraryCounts } from '#lib/stores/library-counts.svelte';
  import { player } from '#lib/player/player.svelte';
  import { LIBRARY_PAGE_SIZE, libraryApi } from '#lib/subsonic/library';
  import type { Starred2 } from '#lib/subsonic/types';
  import CardPlaceholders from '#lib/ui/CardPlaceholders.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import SectionHeader from '#lib/ui/SectionHeader.svelte';
  import Shelf from '#lib/ui/Shelf.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  const shell = getShellNavigation();

  const title = KIND_TITLES.liked;
  const queueSource: QueueSource = LIBRARY_KIND_INFO.liked.queueSource ?? 'liked';

  let starred = $state<Starred2>({});
  let loading = $state(true);
  let failure = $state<string | null>(null);

  /** The library's counts, which size the placeholders. */
  const counts = $derived(libraryCounts.counts);

  onMount(() => {
    void load();
    return events.on('library.changed', () => {
      void load();
    });
  });

  /** Reads the liked albums, artists and songs. */
  async function load(): Promise<void> {
    loading = true;
    failure = null;
    try {
      const answer = await libraryApi.starred();
      starred = answer;
      availability.remember([
        ...(answer.song ?? []),
        ...(answer.album ?? []),
        ...(answer.artist ?? [])
      ]);
    } catch (error) {
      failure = error instanceof Error ? error.message : 'The list could not be read.';
    } finally {
      loading = false;
    }
  }

  /**
   * Queues the liked collection and starts at one of its tracks.
   *
   * @param from The track to start at; absent starts at the head.
   */
  async function playCollection(from?: string): Promise<void> {
    const collection = await loadCollection(queueSource, from);
    if (collection === null || collection.items.length === 0) {
      return;
    }
    player.play(collection.items, collection.startIndex);
  }
</script>

<svelte:head>
  <title>{title} - Hearthsound</title>
</svelte:head>

<PageHeader {title} class="library-header" onnavigation={shell?.openNavigation} />

{#if failure !== null}
  <LoadFailure retry={() => void load()} />
{:else if loading}
  <div class="loading" aria-busy="true">
    <span class="hs-visually-hidden" role="status">Loading...</span>
    {#if firstPagePlaceholders(counts?.likedAlbums ?? null, LIBRARY_PAGE_SIZE) > 0 || firstPagePlaceholders(counts?.likedArtists ?? null, LIBRARY_PAGE_SIZE) > 0}
      <div class="hs-home">
        {#if firstPagePlaceholders(counts?.likedAlbums ?? null, LIBRARY_PAGE_SIZE) > 0}
          <Shelf title="Albums" href="/liked/albums" flush>
            <CardPlaceholders
              count={firstPagePlaceholders(counts?.likedAlbums ?? null, LIBRARY_PAGE_SIZE)}
            />
          </Shelf>
        {/if}
        {#if firstPagePlaceholders(counts?.likedArtists ?? null, LIBRARY_PAGE_SIZE) > 0}
          <Shelf title="Artists" href="/liked/artists" flush>
            <CardPlaceholders
              count={firstPagePlaceholders(counts?.likedArtists ?? null, LIBRARY_PAGE_SIZE)}
              artist
            />
          </Shelf>
        {/if}
      </div>
    {/if}
    {#if firstPagePlaceholders(counts?.likedSongs ?? null, LIBRARY_PAGE_SIZE) > 0}
      <ul class="hs-track-list liked-songs">
        <TrackRowPlaceholders
          count={firstPagePlaceholders(counts?.likedSongs ?? null, LIBRARY_PAGE_SIZE)}
        />
      </ul>
    {/if}
  </div>
{:else if (starred.song ?? []).length === 0 && (starred.album ?? []).length === 0 && (starred.artist ?? []).length === 0}
  <StatusPage
    level={2}
    icon="adwaita-like"
    title="Nothing Liked Yet"
    text="Use the heart on a song, album or artist to keep it here."
  />
{:else}
  <div class="liked">
    {#if (starred.album ?? []).length > 0 || (starred.artist ?? []).length > 0}
      <div class="hs-home">
        {#if (starred.album ?? []).length > 0}
          <Shelf title="Albums" href="/liked/albums" flush>
            {#each starred.album ?? [] as album (album.id)}
              <AlbumCard {album} />
            {/each}
          </Shelf>
        {/if}
        {#if (starred.artist ?? []).length > 0}
          <Shelf title="Artists" href="/liked/artists" flush>
            {#each starred.artist ?? [] as artist (artist.id)}
              <ArtistCard {artist} />
            {/each}
          </Shelf>
        {/if}
      </div>
    {/if}
    {#if (starred.song ?? []).length > 0}
      <SectionHeader title="Songs" level={2} class="liked-songs-heading" />
      <ul class="hs-track-list liked-songs">
        {#each starred.song ?? [] as song (song.id)}
          <SongRow {song} play={() => void playCollection(song.id)} />
        {/each}
      </ul>
    {/if}
  </div>
{/if}

<style>
  /* The loading state lays its placeholders in the loaded state's own grid and
     padding, so the title's gap and the scroll position do not move when the
     read finishes. */
  .loading {
    display: contents;
  }

  .liked {
    display: flex;
    flex-direction: column;
  }

  /* A list fills its own grid at the page margin: the row keeps its own 6 px
     lead inset so its hover tile can start left of the art; pulling the list
     out by that inset puts the art on the content line, under the page title,
     and lets the tile extend into the gutter. */
  .liked-songs {
    margin: 0 0 0 calc(-1 * var(--hs-track-row-inset));
    padding: 0 0 var(--hs-space-6);
  }

  /* The Liked shelves sit at the page margin rather than the Home shelf's
     own 32 px inset, because the shell already pads the content column. The
     package's shelf keeps 32 px of scrollport padding for the Home header it
     normally sits under; here the scrollport keeps exactly the 8 px the cards
     draw their hover tile in, pulled back out of the column, so the first
     card's art starts on the content line under the section title. */
  .liked :global(.liked-songs-heading) {
    /* The Songs heading takes the shelf header's own spacing, so it sits the
       same distance from the shelf above and from its list below. */
    padding: var(--hs-space-3) 0 var(--hs-space-3);
  }

  @media (max-width: 720px) {
    .liked-songs {
      padding: 0 0 var(--hs-space-5);
    }
  }
</style>
