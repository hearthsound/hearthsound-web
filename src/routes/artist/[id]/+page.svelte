<!--
  An artist.

  The approved artist page (p16-r1 A, l09 A): a drill-down header, the round
  portrait, the name, the biography from `getArtistInfo2` clamped to three
  lines with Show more / Show less, the actions and then Top Songs and Albums.
  Top Songs is a k33 link header to the complete list and the five most played
  tracks, whose second line is the album; Albums is the k13 grid, newest first,
  with the release year as the card's second line. A section with nothing in it
  is left out, and an artist with neither gets one muted line (u1-r1).

  Play and Shuffle queue the artist's top songs and then the rest through the
  server's collection queue (queue-scope, queue-api).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import CoverArt from '#lib/components/CoverArt.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import FeedbackControls from '#lib/library/FeedbackControls.svelte';
  import { reportedFeedback } from '#lib/library/feedback';
  import { membership } from '#lib/library/membership.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import SaveButton from '#lib/library/SaveButton.svelte';
  import { navigate } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import { availability } from '#lib/stores/availability.svelte';
  import { isNotFound } from '#lib/subsonic/client';
  import { libraryApi } from '#lib/subsonic/library';
  import type { ArtistWithAlbums, Child } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import Hero from '#lib/ui/Hero.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import SectionHeader from '#lib/ui/SectionHeader.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  /** How many top songs the artist page shows above Albums. */
  const TOP_SONGS_PREVIEW = 5;

  const id = $derived(page.params.id ?? '');

  let artist = $state<ArtistWithAlbums | null>(null);
  let biography = $state('');
  let topSongs = $state<Child[]>([]);
  let failure = $state<string | null>(null);
  let loading = $state(true);

  let generation = 0;

  const albums = $derived(
    [...(artist?.album ?? [])].sort((left, right) => (right.year ?? 0) - (left.year ?? 0))
  );
  const hasTopSongs = $derived(topSongs.length > 0);
  const hasAlbums = $derived(albums.length > 0);
  const artistFeedback = $derived(artist === null ? null : reportedFeedback(artist));

  $effect(() => {
    const current = id;
    const mine = ++generation;
    untrack(() => void load(current, mine));
  });

  /**
   * Returns to the page that opened the artist.
   */
  function back(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      void navigate('/library/artists');
    }
  }

  /**
   * Reads the artist, its biography and its top songs.
   *
   * The biography and the top songs are extras: a failure in either leaves
   * their section out instead of failing the page (u1-r1).
   *
   * @param current The artist's client id.
   * @param mine The generation of this read.
   */
  async function load(current: string, mine: number): Promise<void> {
    loading = true;
    failure = null;
    try {
      const [answer, info, tops] = await Promise.all([
        libraryApi.artist(current),
        libraryApi.artistInfo(current).catch(() => null),
        libraryApi.topSongs(current, TOP_SONGS_PREVIEW).catch(() => [] as Child[])
      ]);
      if (mine !== generation) {
        return;
      }
      artist = answer;
      biography = info?.biography ?? '';
      topSongs = tops;
      if (answer !== null) {
        availability.remember([answer, ...(answer.album ?? []), ...tops]);
        membership.remember([answer]);
      }
    } catch (error) {
      if (mine === generation) {
        failure = isNotFound(error) ? null : 'The server did not answer.';
        artist = null;
        biography = '';
        topSongs = [];
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  /**
   * Queues the artist's collection and starts at one of its tracks.
   *
   * @param from The track to start at; absent starts at the first.
   * @param shuffle Whether to switch the player's shuffled order on.
   */
  async function playCollection(from?: string, shuffle = false): Promise<void> {
    try {
      const collection = await loadCollection(`artist:${id}`, from);
      if (collection === null || collection.items.length === 0) {
        return;
      }
      player.play(collection.items, collection.startIndex);
      player.setShuffle(shuffle);
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not play this artist: ${error.message}`
          : 'Could not play this artist.',
        'error'
      );
    }
  }

  /**
   * Plays one of the artist's top songs, with the artist as the queue.
   *
   * @param song The track to play.
   */
  function playTrack(song: Child): void {
    void playCollection(song.id);
  }
</script>

<svelte:head>
  <title>{artist?.name ?? 'Artist'} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load(id, ++generation)}>Retry</Button>
{/snippet}

{#snippet artwork()}
  <CoverArt coverArt={artist?.coverArt} icon="adwaita-artist" />
{/snippet}

{#snippet heroActions()}
  {#if artist !== null}
    <button
      class="hs-play-button hs-play-button--large"
      type="button"
      aria-label="Play {artist.name}"
      disabled={!hasTopSongs && !hasAlbums}
      onclick={() => void playCollection(undefined, false)}
    >
      <Icon name="adwaita-play" />
    </button>
    <Button
      variant="flat"
      shape="icon"
      icon="adwaita-shuffle"
      label="Shuffle"
      disabled={!hasTopSongs && !hasAlbums}
      onclick={() => void playCollection(undefined, true)}
    />
    {#if artistFeedback !== null}
      <FeedbackControls entity={artistFeedback} variant="like" />
    {/if}
    <Menu label="More Actions">
      <SaveButton entity={artist} />
    </Menu>
  {/if}
{/snippet}

<div class="detail-page artist-page">
  <PageHeader onback={back} />

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
  {:else if loading && artist === null}
    <div class="loading" aria-busy="true">
      <span class="hs-visually-hidden" role="status">Loading...</span>
      <div class="hs-hero">
        <span class="hs-hero__art hs-hero__art--round"
          ><Skeleton width="100%" height="100%" radius="full" /></span
        >
        <div class="hs-hero__text">
          <Skeleton width="240px" height="30px" />
          <Skeleton width="380px" height="12px" />
          <Skeleton width="320px" height="12px" />
        </div>
      </div>
      <ul class="hs-track-list hs-track-list--no-album top-list">
        {#each Array.from({ length: TOP_SONGS_PREVIEW }, (_, index) => index) as row (row)}
          <li class="hs-track-row hs-track-row--no-album" aria-hidden="true">
            <span class="hs-track-row__lead">
              <Skeleton width="40px" height="40px" radius="art-small" />
            </span>
            <span class="hs-track-row__text">
              <Skeleton width="45%" height="12px" />
              <Skeleton width="30%" height="10px" />
            </span>
            <span class="hs-track-row__status"></span>
            <span></span>
            <span class="hs-track-row__duration"><Skeleton width="30px" height="10px" /></span>
          </li>
        {/each}
      </ul>
      <div class="hs-card-grid album-grid">
        {#each Array.from({ length: 3 }, (_, index) => index) as card (card)}
          <div class="hs-card" aria-hidden="true">
            <span class="hs-card__cover"><Skeleton width="100%" height="100%" radius="art" /></span>
            <span class="hs-card__text">
              <Skeleton width="80%" height="14px" />
              <Skeleton width="50%" height="13px" />
            </span>
          </div>
        {/each}
      </div>
    </div>
  {:else if artist === null}
    <div class="state">
      <StatusPage
        icon="adwaita-artist"
        title="Artist Not Found"
        text="It is not in your library."
      />
    </div>
  {:else}
    <Hero title={artist.name} {artwork} round bio={biography} actions={heroActions} />

    {#if !hasTopSongs && !hasAlbums}
      <p class="artist-empty">Nothing by this artist in your library yet.</p>
    {:else}
      {#if hasTopSongs}
        <div class="top-header">
          <SectionHeader title="Top Songs" href={`/artist/${id}/top-songs`} level={2} />
        </div>
        <ul class="hs-track-list hs-track-list--no-album top-list">
          {#each topSongs as song (song.id)}
            <SongRow {song} context="no-album" second="album" play={playTrack} />
          {/each}
        </ul>
      {/if}

      {#if hasAlbums}
        <div class="albums-header">
          <SectionHeader title="Albums" level={2} />
        </div>
        <div class="hs-card-grid album-grid">
          {#each albums as album (album.id)}
            <AlbumCard
              {album}
              subtitle={album.year === undefined || album.year <= 0 ? '' : String(album.year)}
            />
          {/each}
        </div>
      {/if}
    {/if}
  {/if}
</div>

<style>
  /* The shell already holds the page off the window edge. The hero keeps only
     the 8 px that puts its portrait on the approved content line; the section
     headers keep the other 8 px the board gives them (fc5b-diff). */
  .detail-page :global(.hs-page-header) {
    padding-inline: 0;
  }

  .detail-page :global(.hs-hero) {
    padding: var(--hs-space-3) var(--hs-space-3) calc(var(--hs-space-6) + var(--hs-space-1));
  }

  .top-header {
    padding: var(--hs-space-3);
  }

  .top-list {
    margin: 0;
    padding: 0 0 var(--hs-space-2);
    list-style: none;
  }

  .albums-header {
    padding: var(--hs-space-3) var(--hs-space-3) 6px;
  }

  .album-grid {
    padding: var(--hs-space-3) var(--hs-space-3) var(--hs-space-7);
  }

  .artist-empty {
    margin: 0;
    padding: 0 var(--hs-space-3) calc(var(--hs-space-6) + var(--hs-space-1));
    color: var(--hs-fg-muted);
  }

  .state {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 60vh;
  }

  @media (max-width: 720px) {
    .detail-page :global(.hs-hero) {
      padding: var(--hs-space-2) var(--hs-space-1) 18px;
    }

    .top-header,
    .albums-header {
      margin-inline: calc(-1 * var(--hs-space-1));
      padding: var(--hs-space-3) 0 6px;
    }

    .top-list {
      margin-inline: calc(-1 * var(--hs-space-3));
    }

    .album-grid {
      padding: var(--hs-space-3) var(--hs-space-1) 18px;
    }

    .artist-empty {
      padding: 0 var(--hs-space-1) 18px;
    }
  }
</style>
