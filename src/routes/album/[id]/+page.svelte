<!--
  An album.

  The album's page reads one answer: `GET /api/v1/albums/{id}` carries the
  release details, the credits, the genre list and the tracklist the server
  stored, plus the primary artist's other albums. The hero is the square cover,
  the title, the artist, the length line and the release's date, type and
  edition; then the tracklist and the "More by" shelf, whose header opens the
  artist's page.

  A page the server fetched only partly answers `complete: false`; an empty
  tracklist shimmers instead of claiming the album has no songs, and the
  `entity.updated` event for the album reads the page once more. The actions
  queue the whole tracklist through the server's album collection. An
  administrator's menu also queues a metadata refresh.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import CoverArt from '#lib/components/CoverArt.svelte';
  import FeedbackControls from '#lib/library/FeedbackControls.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import AddToPlaylist from '#lib/library/AddToPlaylist.svelte';
  import { loadAlbum, refreshEntity, songOf } from '#lib/entities/api';
  import type { AlbumPage } from '#lib/entities/api';
  import { releaseDetails } from '#lib/entities/format';
  import { formatMinuteTotal } from '#lib/format';
  import { membership } from '#lib/library/membership.svelte';
  import PlaylistDialog from '#lib/library/PlaylistDialog.svelte';
  import { addPlaylistSource } from '#lib/library/playlist-write';
  import SaveButton from '#lib/library/SaveButton.svelte';
  import TrackRowPlaceholders from '#lib/library/TrackRowPlaceholders.svelte';
  import { goBack } from '#lib/navigation';
  import { artistHref } from '#lib/paths';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { availability } from '#lib/stores/availability.svelte';
  import { events } from '#lib/stores/events.svelte';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Hero from '#lib/ui/Hero.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Shelf from '#lib/ui/Shelf.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import type { Playlist } from '#lib/subsonic/types';

  /** The album's client id, as the address spells it. */
  const albumId = $derived(page.params.id ?? '');

  let album = $state<AlbumPage | null>(null);
  let loading = $state(true);
  let failure = $state<string | null>(null);
  let creatingPlaylist = $state(false);

  let generation = 0;

  /** How often an incomplete page is read again. */
  const INCOMPLETE_POLL_MS = 10_000;

  /** How many times a visit reads an incomplete page again, at most. */
  const INCOMPLETE_POLL_LIMIT = 12;

  /** How many times this visit has read an incomplete page again. */
  let polls = 0;

  /**
   * Whether this visit has waited long enough for the rest of the page. The
   * placeholders give way to the stored answer once it has.
   */
  let stalled = $state(false);

  /** The tracks the page draws, whichever answer still holds them. */
  const tracks = $derived(album?.tracks ?? []);
  const complete = $derived(album?.complete !== false || stalled);
  const hasTracks = $derived(tracks.length > 0);
  /** Whether the page draws track placeholders: the answer is still partial. */
  const awaitingTracks = $derived(!hasTracks && !complete);
  const artist = $derived(album?.artists[0] ?? null);
  const details = $derived(
    album === null
      ? ''
      : releaseDetails({
          releaseDate: album.releaseDate,
          year: album.year,
          albumType: album.albumType,
          edition: album.edition
        })
  );
  /** The track count and length line under the artist. */
  const lengthLine = $derived.by(() => {
    if (album === null) {
      return '';
    }
    const count = album.trackCount ?? tracks.length;
    const parts: string[] = [];
    if (count > 0) {
      parts.push(`${count} ${count === 1 ? 'song' : 'songs'}`);
    }
    if (album.durationMs !== null && album.durationMs > 0) {
      parts.push(formatMinuteTotal(album.durationMs / 1000));
    }
    return parts.join(' - ');
  });
  const opinion = $derived({
    id: albumId,
    liked: album?.liked ?? false,
    disliked: album?.disliked ?? false,
    rating: album?.rating ?? 0
  });
  const moreByArtist = $derived((album?.moreByArtist ?? []).slice(0, 12));

  $effect(() => {
    const id = albumId;
    const mine = ++generation;
    polls = 0;
    stalled = false;
    untrack(() => void load(id, mine));
  });

  // The server answers a page it is still indexing with `complete: false`, and
  // the announcement that the rest arrived may be lost or may never come at all
  // - a walk can fail. Reading again on a timer lets the placeholders give way
  // to the stored answer; after the last read the page is taken as complete, so
  // nothing shimmers for a visitor who stays.
  $effect(() => {
    const id = albumId;
    const answer = album;
    if (id === '' || answer === null || answer.complete !== false) {
      polls = 0;
      return;
    }
    if (polls >= INCOMPLETE_POLL_LIMIT) {
      stalled = true;
      return;
    }
    polls += 1;
    const timer = setTimeout(() => {
      void reload(id, generation);
    }, INCOMPLETE_POLL_MS);
    return () => clearTimeout(timer);
  });

  // A stream that lost events re-reads the page: the indexer's announcement may
  // have been among them.
  let seenResync = $state(events.resync);
  $effect(() => {
    const resync = events.resync;
    const id = albumId;
    if (resync === seenResync || id === '') {
      return;
    }
    seenResync = resync;
    untrack(() => void reload(id, generation));
  });

  // The indexer stored more about this album: read the page once more, without
  // touching the page's own loading and failure state.
  $effect(() => {
    const id = albumId;
    if (id === '') {
      return;
    }
    return events.on('entity.updated', (event) => {
      if (event.data.kind !== 'album' || event.data.id !== id) {
        return;
      }
      void reload(id, generation);
    });
  });

  /** Returns to the page that opened the album. */
  function back(): void {
    goBack('/library/albums');
  }

  /**
   * Reads the album's page.
   *
   * @param id The album's client id or a merged-away id.
   * @param mine The generation of this read.
   */
  async function load(id: string, mine: number): Promise<void> {
    loading = true;
    failure = null;
    album = null;
    try {
      const answer = await loadAlbum(id);
      if (mine !== generation) {
        return;
      }
      album = answer;
      if (answer !== null) {
        availability.remember(answer.tracks);
        membership.remember([answer, ...answer.moreByArtist]);
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
   * Reads the page again once the indexer stored more.
   *
   * @param id The album's client id.
   * @param mine The generation this read belongs to.
   */
  async function reload(id: string, mine: number): Promise<void> {
    let answer: AlbumPage | null;
    try {
      answer = await loadAlbum(id);
    } catch {
      return;
    }
    if (mine !== generation || answer === null) {
      return;
    }
    album = answer;
    availability.remember(answer.tracks);
    membership.remember([answer, ...answer.moreByArtist]);
  }

  /**
   * Queues the whole album and starts at one of its tracks.
   *
   * @param from The track to start at; absent starts at the first.
   * @param shuffle Whether to switch the player's shuffled order on.
   */
  function playCollection(from?: string, shuffle = false): void {
    const index = from === undefined ? 0 : tracks.findIndex((track) => track.id === from);
    if (tracks.length > 0) {
      player.play(
        tracks.map((track) => queueItemOf(songOf(track))),
        Math.max(0, index)
      );
      player.setShuffle(shuffle);
    }
  }

  /**
   * Adds every track of the album to a playlist that was just created.
   *
   * @param playlist The playlist the dialog created.
   */
  async function addToNewPlaylist(playlist: Playlist): Promise<void> {
    creatingPlaylist = false;
    try {
      await addPlaylistSource(playlist.id, `album:${albumId}`);
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

  /** Queues a metadata refresh for this album. */
  async function refresh(): Promise<void> {
    try {
      await refreshEntity(albumId);
      toasts.push('Metadata refresh queued.');
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? error.message
          : 'Could not refresh this album.',
        'error'
      );
    }
  }
</script>

<svelte:head>
  <title>{album?.title ?? 'Album'} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load(albumId, ++generation)}>Retry</Button>
{/snippet}

{#snippet artwork()}
  <CoverArt coverArt={album?.hasImage === true ? album.id : null} icon="adwaita-album" />
{/snippet}

{#snippet heroActions()}
  {#if album !== null}
    <button
      class="hs-play-button hs-play-button--large"
      type="button"
      aria-label="Play {album.title}"
      disabled={!hasTracks}
      onclick={() => playCollection(undefined, false)}
    >
      <Icon name="adwaita-play" />
    </button>
    <Button
      variant="flat"
      shape="icon"
      icon="adwaita-shuffle"
      label="Shuffle"
      disabled={!hasTracks}
      onclick={() => playCollection(undefined, true)}
    />
    <FeedbackControls entity={opinion} variant="like" />
    <Menu label="More Actions">
      <div class="hs-song-menu__rating-line">
        <span>Rating</span>
        <FeedbackControls entity={opinion} variant="stars" menuItem />
      </div>
      <MenuSeparator />
      <SaveButton entity={{ id: albumId, inLibrary: album.inLibrary }} />
      <MenuSeparator />
      <AddToPlaylist source={`album:${albumId}`} onnew={() => (creatingPlaylist = true)} />
      {#if session.isAdmin}
        <MenuSeparator />
        <MenuItem label="Refresh Metadata" icon="adwaita-refresh" onselect={() => void refresh()} />
      {/if}
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
      title={album.title}
      by={album.displayArtist ?? artist?.name}
      byHref={artist === null ? undefined : artistHref(artist.id)}
      meta={[lengthLine, details].filter((line) => line !== '')}
      {artwork}
      actions={heroActions}
    />

    {#if hasTracks}
      <ul class="hs-track-list hs-track-list--album tracks">
        {#each tracks as track, index (track.id)}
          {@const song = songOf(track)}
          <SongRow
            {song}
            context="album"
            number={index + 1}
            play={(picked) => playCollection(picked.id)}
            libraryMark
          />
        {/each}
      </ul>
    {:else if awaitingTracks}
      <ul class="hs-track-list hs-track-list--album tracks" aria-busy="true">
        <TrackRowPlaceholders count={album.trackCount ?? 6} />
      </ul>
    {:else}
      <p class="album-empty">This album has no songs.</p>
    {/if}

    {#if moreByArtist.length > 0}
      <div class="more-by">
        <Shelf
          title={artist === null ? 'More by this artist' : `More by ${artist.name}`}
          href={artist === null ? undefined : artistHref(artist.id)}
        >
          {#each moreByArtist as other (other.id)}
            <AlbumCard album={other} libraryMark />
          {/each}
        </Shelf>
      </div>
    {/if}
  {/if}
</div>

{#if creatingPlaylist}
  <PlaylistDialog
    created={(created) => void addToNewPlaylist(created)}
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

  .more-by {
    padding: 0 var(--hs-space-3) var(--hs-space-7);
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

    .album-empty,
    .more-by {
      padding: 0 var(--hs-space-1) 18px;
    }
  }
</style>
