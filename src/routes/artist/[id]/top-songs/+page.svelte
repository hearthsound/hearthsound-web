<!--
  An artist's complete top songs list (p16-r1, c03 item 9, E8).

  The k33 "Top Songs" header on the artist page opens this full-list page: the
  artist's most played tracks, up to 100, as k12 rows in the no-album context
  with the album as their second line. It carries the l03 back button, the
  heading "Top Songs by <Artist>" and the o03 status page when the read fails.
  A row queues the top songs collection through the server's collection queue
  (queue-api).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import SongRow from '#lib/components/SongRow.svelte';
  import { membership } from '#lib/library/membership.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import { goBack } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import TrackRowPlaceholders from '#lib/library/TrackRowPlaceholders.svelte';
  import { availability } from '#lib/stores/availability.svelte';
  import { entities } from '#lib/stores/entities';
  import { isNotFound } from '#lib/subsonic/client';
  import { libraryApi } from '#lib/subsonic/library';
  import type { ArtistWithAlbums, Child } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  /** How many tracks the full list asks for; the server caps the answer. */
  const TOP_SONGS_LIMIT = 100;

  const id = $derived(page.params.id ?? '');

  let artist = $state<ArtistWithAlbums | null>(null);
  let songs = $state<Child[]>([]);
  let failure = $state<string | null>(null);
  let loading = $state(true);

  let generation = 0;

  const heading = $derived(artist === null ? 'Top Songs' : `Top Songs by ${artist.name}`);
  /**
   * The rows to draw while the list is pending.
   *
   * The list is an artist's most played tracks up to the limit, so the artist's
   * own song count sizes it: a box of a hundred shimmers for an artist with
   * three songs would promise a page the reader will never see. Before the
   * artist is read the size is unknown, and no row is drawn.
   */
  const placeholders = $derived(
    artist?.album === undefined
      ? 0
      : Math.min(
          TOP_SONGS_LIMIT,
          (artist.album ?? []).reduce((total, album) => total + (album.songCount ?? 0), 0)
        )
  );

  $effect(() => {
    const current = id;
    const mine = ++generation;
    untrack(() => void load(current, mine));
  });

  /** Returns to the artist page. */
  function back(): void {
    goBack(`/artist/${id}`);
  }

  /**
   * Reads the artist and its most played tracks.
   *
   * @param current The artist's client id.
   * @param mine The generation of this read.
   */
  async function load(current: string, mine: number): Promise<void> {
    // The artist card already drew the artist, so its name is in the heading
    // before this page's own reads answer.
    artist = entities.artist(current) ?? null;
    loading = true;
    failure = null;
    try {
      const [answer, tops] = await Promise.all([
        libraryApi.artist(current),
        libraryApi.topSongs(current, TOP_SONGS_LIMIT)
      ]);
      if (mine !== generation) {
        return;
      }
      artist = answer;
      songs = tops;
      if (answer !== null) {
        availability.remember([answer, ...(answer.album ?? []), ...tops]);
        membership.remember([answer, ...(answer.album ?? []), ...tops]);
      }
    } catch (error) {
      if (mine === generation) {
        failure = isNotFound(error) ? null : 'The server did not answer.';
        artist = null;
        songs = [];
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  /**
   * Queues the artist's top songs and starts at one of them.
   *
   * @param song The track to play.
   */
  async function playSong(song: Child): Promise<void> {
    try {
      const collection = await loadCollection(`artist-top:${id}`, song.id);
      if (collection === null || collection.items.length === 0) {
        return;
      }
      player.play(collection.items, collection.startIndex);
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not play these songs: ${error.message}`
          : 'Could not play these songs.',
        'error'
      );
    }
  }
</script>

<svelte:head>
  <title>{heading} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load(id, ++generation)}>Retry</Button>
{/snippet}

<div class="top-songs-page">
  <PageHeader title={heading} onback={back} />

  {#if failure !== null}
    <div class="state">
      <StatusPage
        alert
        icon="adwaita-error"
        title="Could Not Load This Page"
        text="The server did not answer. Try again in a moment."
        action={retryAction}
      />
    </div>
  {:else if loading}
    <div class="loading" aria-busy="true">
      <span class="hs-visually-hidden" role="status">Loading...</span>
      <ul class="hs-track-list hs-track-list--no-album songs">
        <TrackRowPlaceholders count={placeholders} />
      </ul>
    </div>
  {:else if artist === null}
    <div class="state">
      <StatusPage
        icon="adwaita-artist"
        title="Artist Not Found"
        text="It is not in your library."
      />
    </div>
  {:else if songs.length === 0}
    <StatusPage
      inline
      icon="adwaita-song"
      title="No Songs Yet"
      text="Songs you like, save, add to a playlist or upload show up here."
    />
  {:else}
    <ul class="hs-track-list hs-track-list--no-album songs">
      {#each songs as song (song.id)}
        <SongRow
          {song}
          context="no-album"
          second="album"
          play={(picked) => void playSong(picked)}
          libraryMark
        />
      {/each}
    </ul>
  {/if}
</div>

<style>
  .top-songs-page :global(.hs-page-header) {
    padding-inline: 0;
  }

  .songs {
    margin: 0;
    padding: 0 0 var(--hs-space-6);
    list-style: none;
  }

  .state {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 60vh;
  }

  @media (max-width: 720px) {
    .songs {
      margin-inline: calc(-1 * var(--hs-space-3));
    }
  }
</style>
