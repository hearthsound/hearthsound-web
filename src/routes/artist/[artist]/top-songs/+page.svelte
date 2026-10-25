<!--
  An artist's complete top songs list (p16-r1, c03 item 9, E8).

  The k33 "Top Songs" header on the artist page opens this full-list page: the
  artist's most played tracks, up to 100, as k12 rows in the no-album context
  with the album as their second line. It carries the l03 back button, the
  heading "Top Songs by <Artist>" and the o03 status page when the read fails.
  A row plays the list the page already holds, so a catalog track goes through
  the acquisition flow like any other. The address carries the artist's readable
  path.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import SongRow from '#lib/components/SongRow.svelte';
  import { membership } from '#lib/library/membership.svelte';
  import { goBack, replaceRoute } from '#lib/navigation';
  import { artistHrefFromPath, targetOf } from '#lib/paths';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
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

  /** The artist's path segment, as the address spells it. */
  const segment = $derived(page.params.artist ?? '');
  /** The artist's page path, which the back button returns to. */
  const route = $derived(`/artist/${encodeURIComponent(segment)}`);
  /** The artist's client id, once the path or the click answered. */
  let entityId = $state('');

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
    const current = segment;
    const mine = ++generation;
    untrack(() => void load(current, mine));
  });

  /** Returns to the artist page. */
  function back(): void {
    goBack(route);
  }

  /**
   * Reads the artist and its most played tracks.
   *
   * @param current The artist's path segment.
   * @param mine The generation of this read.
   */
  async function load(current: string, mine: number): Promise<void> {
    // The artist card already drew the artist, so its name is in the heading
    // before this page's own reads answer.
    const remembered = targetOf(page.url.pathname);
    artist = remembered === undefined ? null : (entities.artist(remembered) ?? null);
    loading = true;
    failure = null;

    let resolved;
    try {
      resolved = await libraryApi.resolve(
        remembered === undefined ? { artist: current } : { id: remembered }
      );
    } catch {
      if (mine === generation) {
        failure = 'The server did not answer.';
        artist = null;
        songs = [];
        loading = false;
      }
      return;
    }
    if (mine !== generation) {
      return;
    }
    if (resolved === null) {
      artist = null;
      songs = [];
      loading = false;
      return;
    }
    entityId = resolved.id;
    const canonical = artistHrefFromPath(resolved.path) ?? route;
    if (canonical !== route) {
      replaceRoute(canonical);
    }
    artist = entities.artist(entityId) ?? artist;
    try {
      const [answer, tops] = await Promise.all([
        libraryApi.artist(entityId),
        libraryApi.topSongs(entityId, TOP_SONGS_LIMIT)
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
   * Plays one of the top songs, with the list the page holds as the queue.
   *
   * @param song The track to play.
   */
  function playSong(song: Child): void {
    const index = songs.findIndex((row) => row.id === song.id);
    if (songs.length > 0) {
      player.play(songs.map(queueItemOf), Math.max(0, index));
    }
  }
</script>

<svelte:head>
  <title>{heading} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load(segment, ++generation)}>Retry</Button>
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
        <SongRow {song} context="no-album" second="album" play={playSong} libraryMark />
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
