<!--
  An album.

  The approved album page (p15 B, l09 A): a drill-down header with the back
  button, the hero with the square cover, the title, the artist, the year and
  track detail line and the actions, then the tracks in album context. The
  actions queue the whole album through the server's collection queue
  (queue-api); the menu carries the library membership command and adds the
  whole album to a playlist. A track that is not on the server goes through the
  acquisition flow like any other.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import CoverArt from '#lib/components/CoverArt.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { formatMinuteTotal } from '#lib/format';
  import AddToPlaylist from '#lib/library/AddToPlaylist.svelte';
  import { awaitingEnrichment } from '#lib/library/enrichment';
  import FeedbackControls from '#lib/library/FeedbackControls.svelte';
  import { reportedFeedback } from '#lib/library/feedback';
  import { membership } from '#lib/library/membership.svelte';
  import PlaylistDialog from '#lib/library/PlaylistDialog.svelte';
  import { addPlaylistSource } from '#lib/library/playlist-write';
  import TrackRowPlaceholders from '#lib/library/TrackRowPlaceholders.svelte';
  import SaveButton from '#lib/library/SaveButton.svelte';
  import { goBack, replaceRoute } from '#lib/navigation';
  import { albumArtistHref, albumHrefFromPath, targetOf } from '#lib/paths';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { availability } from '#lib/stores/availability.svelte';
  import { events } from '#lib/stores/events.svelte';
  import { entities } from '#lib/stores/entities';
  import { toasts } from '#lib/stores/toasts.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { AlbumWithSongs, Child, Playlist } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import Hero from '#lib/ui/Hero.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  /** The artist segment of the album's path, as the address spells it. */
  const artistSegment = $derived(page.params.artist ?? '');
  /** The album segment of the album's path, as the address spells it. */
  const albumSegment = $derived(page.params.album ?? '');
  /** The album's page path, built from the two segments the address carries. */
  const route = $derived(
    `/album/${encodeURIComponent(artistSegment)}/${encodeURIComponent(albumSegment)}`
  );
  /**
   * The album's client id, once the path or the click that opened the page
   * answered. Reads and playback use this; the address never does.
   */
  let entityId = $state('');

  let album = $state<AlbumWithSongs | null>(null);
  let failure = $state<string | null>(null);
  let loading = $state(true);
  let creatingPlaylist = $state(false);
  /**
   * Whether the enrichment job of this album has announced itself, so a page
   * that is still cold stops waiting for tracks.
   */
  let extrasSettled = $state(false);

  let generation = 0;

  const tracks = $derived(album?.song ?? []);
  const hasSongs = $derived(tracks.length > 0);
  /** Whether the tracks are known: a seed from a card carries the counts, not the songs. */
  const songsLoaded = $derived(album?.song !== undefined);
  const albumFeedback = $derived(album === null ? null : reportedFeedback(album));
  const details = $derived(album === null ? [] : detailLines(album));
  /**
   * Whether the page waits for the enrichment of a cold catalog album: the
   * hero is there, the tracks are not yet, and the page must not say the album
   * has none.
   */
  const awaitingTracks = $derived(
    awaitingEnrichment({
      origin: album?.hearthsound?.origin,
      settled: extrasSettled,
      hasExtras: hasSongs
    })
  );

  $effect(() => {
    const artist = artistSegment;
    const album = albumSegment;
    const mine = ++generation;
    untrack(() => void load(artist, album, mine));
  });

  // The enrichment job announces the album it filled in; the page reads the
  // whole album again without touching its own loading or failure state, and a
  // page that already holds tracks does not ask.
  $effect(() => {
    const id = entityId;
    if (id === '') {
      return;
    }
    return events.on('catalog.enriched', (event) => {
      if (event.data.entityId !== id || event.data.kind !== 'album') {
        return;
      }
      extrasSettled = true;
      if (!hasSongs) {
        void refresh(id);
      }
    });
  });

  /** Returns to the page that opened the album. */
  function back(): void {
    goBack('/library/albums');
  }

  /**
   * Reads the album and remembers what its entities report.
   *
   * The path is resolved to the album's id first: a link carries the names, a
   * click carries the id, and both name the same page.
   *
   * @param artistPath The artist segment of the album's path.
   * @param albumPath The album segment of the album's path.
   * @param mine The generation of this read.
   */
  async function load(artistPath: string, albumPath: string, mine: number): Promise<void> {
    // The card that opened this page already drew the album, so the hero is
    // there before the server answers and only the tracks can still be missing.
    const remembered = targetOf(page.url.pathname);
    album = remembered === undefined ? null : (entities.album(remembered) ?? null);
    extrasSettled = false;
    loading = true;
    failure = null;

    let resolved;
    try {
      resolved = await libraryApi.resolve(
        remembered === undefined ? { artist: artistPath, album: albumPath } : { id: remembered }
      );
    } catch {
      if (mine === generation) {
        failure = 'The server did not answer.';
        album = null;
        loading = false;
      }
      return;
    }
    if (mine !== generation) {
      return;
    }
    if (resolved === null) {
      album = null;
      loading = false;
      return;
    }
    entityId = resolved.id;
    const canonical = albumHrefFromPath(resolved.path) ?? route;
    if (canonical !== route) {
      replaceRoute(canonical);
    }
    album = entities.album(entityId) ?? album;
    try {
      const answer = await libraryApi.album(entityId);
      if (mine !== generation) {
        return;
      }
      album = answer;
      if (answer !== null) {
        availability.remember([answer, ...(answer.song ?? [])]);
        membership.remember([answer, ...(answer.song ?? [])]);
      }
    } catch {
      if (mine === generation) {
        failure = 'The server did not answer.';
        album = null;
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  /**
   * Reads the album again once its enrichment job filled it in.
   *
   * The answer replaces the album the page holds only when the generation still
   * matches and the read succeeded; the page's own loading and failure state is
   * untouched, because this is an addition, not the page's first read.
   *
   * @param id The album's client id.
   */
  async function refresh(id: string): Promise<void> {
    const mine = generation;
    let answer: AlbumWithSongs | null;
    try {
      answer = await libraryApi.album(id);
    } catch {
      return;
    }
    if (mine !== generation || answer === null) {
      return;
    }
    album = answer;
    availability.remember([answer, ...(answer.song ?? [])]);
    membership.remember([answer, ...(answer.song ?? [])]);
  }

  /**
   * Queues the whole album and starts at one of its tracks.
   *
   * The page holds the album's whole tracklist, stored and catalog together, so
   * nothing more is read: the tracks this page already drew are the queue.
   *
   * @param from The track to start at; absent starts at the first.
   * @param shuffle Whether to switch the player's shuffled order on.
   */
  function playCollection(from?: string, shuffle = false): void {
    const index = from === undefined ? 0 : tracks.findIndex((song) => song.id === from);
    if (tracks.length > 0) {
      player.play(tracks.map(queueItemOf), Math.max(0, index));
      player.setShuffle(shuffle);
    }
  }

  /**
   * Plays one of the album's tracks, with the whole album as the queue.
   *
   * @param song The track to play.
   */
  function playTrack(song: Child): void {
    void playCollection(song.id);
  }

  /**
   * Adds every track of the album to a playlist that was just created.
   *
   * @param playlist The playlist the dialog created.
   */
  async function addToNewPlaylist(playlist: Playlist): Promise<void> {
    creatingPlaylist = false;
    try {
      await addPlaylistSource(playlist.id, `album:${entityId}`);
      toasts.push(`Added to ${playlist.name}.`);
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not add it to ${playlist.name}: ${error.message}`
          : `Could not add it to ${playlist.name}.`,
        'error'
      );
    }
  }

  /**
   * Formats the hero's muted detail line: year, songs and minutes.
   *
   * @param entry The album.
   * @returns The line, or an empty list when nothing is known.
   */
  function detailLines(entry: AlbumWithSongs): string[] {
    const parts: string[] = [];
    if (entry.year !== undefined && entry.year > 0) {
      parts.push(String(entry.year));
    }
    const count = (entry.song ?? []).length;
    const songs = `${count} ${count === 1 ? 'song' : 'songs'}`;
    parts.push(songs);
    const sum = (entry.song ?? []).reduce((total, song) => total + (song.duration ?? 0), 0);
    const seconds = entry.duration !== undefined && entry.duration > 0 ? entry.duration : sum;
    if (seconds > 0) {
      parts.push(formatMinuteTotal(seconds));
    }
    return [parts.join(' - ')];
  }
</script>

<svelte:head>
  <title>{album?.name ?? 'Album'} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load(artistSegment, albumSegment, ++generation)}>Retry</Button>
{/snippet}

{#snippet artwork()}
  <CoverArt coverArt={album?.coverArt} icon="adwaita-album" />
{/snippet}

{#snippet heroActions()}
  {#if album !== null}
    <button
      class="hs-play-button hs-play-button--large"
      type="button"
      aria-label="Play {album.name}"
      disabled={!hasSongs}
      onclick={() => playCollection(undefined, false)}
    >
      <Icon name="adwaita-play" />
    </button>
    <Button
      variant="flat"
      shape="icon"
      icon="adwaita-shuffle"
      label="Shuffle"
      disabled={!hasSongs}
      onclick={() => playCollection(undefined, true)}
    />
    {#if albumFeedback !== null}
      <FeedbackControls entity={albumFeedback} variant="like" />
    {/if}
    <Menu label="More Actions">
      {#if albumFeedback !== null}
        <div class="hs-song-menu__rating-line">
          <span>Rating</span>
          <FeedbackControls entity={albumFeedback} variant="stars" menuItem />
        </div>
        <MenuSeparator />
      {/if}
      <SaveButton entity={album} />
      <MenuSeparator />
      <AddToPlaylist source={`album:${entityId}`} onnew={() => (creatingPlaylist = true)} />
    </Menu>
  {/if}
{/snippet}

<div class="detail-page album-page">
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
  {:else if loading && album === null}
    <div class="loading" aria-busy="true">
      <span class="hs-visually-hidden" role="status">Loading...</span>
      <div class="hs-hero">
        <span class="hs-hero__art"><Skeleton width="100%" height="100%" radius="art" /></span>
        <div class="hs-hero__text">
          <Skeleton width="320px" height="30px" />
          <Skeleton width="140px" height="14px" />
          <Skeleton width="110px" height="12px" />
        </div>
      </div>
      <ul class="hs-track-list hs-track-list--album tracks">
        {#each Array.from({ length: 6 }, (_, index) => index) as row (row)}
          <li class="hs-track-row hs-track-row--album" aria-hidden="true">
            <span class="hs-track-row__lead"><Skeleton width="16px" height="12px" /></span>
            <span class="hs-track-row__text"><Skeleton width="40%" height="12px" /></span>
            <span class="hs-track-row__status"></span>
            <span></span>
            <span class="hs-track-row__duration"><Skeleton width="30px" height="10px" /></span>
          </li>
        {/each}
      </ul>
    </div>
  {:else if album === null}
    <div class="state">
      <StatusPage
        icon="adwaita-album"
        title="Album Not Found"
        text="It may have been removed, or the link is wrong."
      />
    </div>
  {:else}
    <Hero
      title={album.name}
      by={album.artist}
      byHref={albumArtistHref(album)}
      byTargetId={album.artistId}
      meta={details}
      {artwork}
      actions={heroActions}
    />

    {#if !songsLoaded && loading}
      <ul class="hs-track-list hs-track-list--album tracks">
        <TrackRowPlaceholders count={Math.max(0, album.songCount ?? 0)} />
      </ul>
    {:else if awaitingTracks}
      <!-- The enrichment job has not landed yet: the hero is the whole page,
           and the album must not claim to have no songs. -->
    {:else if !hasSongs}
      <p class="album-empty">This album has no songs.</p>
    {:else}
      <ul class="hs-track-list hs-track-list--album tracks">
        {#each tracks as song, index (song.id)}
          <SongRow {song} context="album" number={index + 1} play={playTrack} libraryMark />
        {/each}
      </ul>
    {/if}
  {/if}
</div>

{#if creatingPlaylist}
  <PlaylistDialog
    created={(playlist) => void addToNewPlaylist(playlist)}
    close={() => (creatingPlaylist = false)}
  />
{/if}

<style>
  /* The shell already holds the page off the window edge. The hero keeps only
     the 8 px that puts its cover on the approved content line, and the track
     list starts the row's own 6 px inset (fc5b-diff). */
  .detail-page :global(.hs-page-header) {
    padding-inline: 0;
  }

  .detail-page :global(.hs-hero) {
    padding: var(--hs-space-3) var(--hs-space-3) calc(var(--hs-space-6) + var(--hs-space-1));
  }

  .tracks {
    margin: 0;
    padding: 0 0 var(--hs-space-6);
    list-style: none;
  }

  .album-empty {
    margin: 0;
    padding: 0 var(--hs-space-3) calc(var(--hs-space-6) + var(--hs-space-1));
    color: var(--hs-fg-muted);
  }

  /* The o03 status page fills the content area below the header. */
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

    .tracks {
      margin-inline: calc(-1 * var(--hs-space-3));
      padding: 0 0 var(--hs-space-6);
    }

    .album-empty {
      padding: 0 var(--hs-space-1) 18px;
    }
  }
</style>
