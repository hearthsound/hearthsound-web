<!--
  An artist.

  The artist's page reads one answer: `GET /api/v1/artists/{id}` carries the
  biography, the links, the top songs, the discography and similar artists the
  server stored. The hero is the round portrait, the name, the clamped
  biography and the actions; the links row follows it. Top Songs is a five-row
  preview with a link to the complete list, Albums is the discography grid
  newest first, and Similar Artists is a shelf. A section with nothing in it is
  left out.

  A page the server fetched only partly answers `complete: false`; its empty
  sections shimmer instead of claiming the artist has nothing, and the
  `entity.updated` event for the artist reads the page once more. An
  administrator's menu also queues a metadata refresh.
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import CoverArt from '#lib/components/CoverArt.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { loadArtist, refreshEntity, songOf } from '#lib/entities/api';
  import type { ArtistPage } from '#lib/entities/api';
  import { albumCardSubtitle, artistLinks } from '#lib/entities/format';
  import { membership } from '#lib/library/membership.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import { goBack } from '#lib/navigation';
  import { topSongsHref } from '#lib/paths';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { availability } from '#lib/stores/availability.svelte';
  import { events } from '#lib/stores/events.svelte';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Button from '#lib/ui/Button.svelte';
  import CardPlaceholders from '#lib/ui/CardPlaceholders.svelte';
  import FeedbackControls from '#lib/library/FeedbackControls.svelte';
  import SaveButton from '#lib/library/SaveButton.svelte';
  import Hero from '#lib/ui/Hero.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import SectionHeader from '#lib/ui/SectionHeader.svelte';
  import Shelf from '#lib/ui/Shelf.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import TrackRowPlaceholders from '#lib/library/TrackRowPlaceholders.svelte';

  /** How many top songs the artist page previews. */
  const TOP_SONGS_PREVIEW = 5;

  /** How many album cards stand in while the discography is still arriving. */
  const ALBUM_PLACEHOLDERS = 6;

  /** How many similar artist cards stand in while the shelf is arriving. */
  const SIMILAR_PLACEHOLDERS = 4;

  /** The artist's client id, as the address spells it. */
  const artistId = $derived(page.params.id ?? '');

  let artist = $state<ArtistPage | null>(null);
  let loading = $state(true);
  let failure = $state<string | null>(null);

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

  /** The discography, newest first. */
  const albums = $derived(
    [...(artist?.albums ?? [])].sort(
      (left, right) => (right.year ?? 0) - (left.year ?? 0) || left.title.localeCompare(right.title)
    )
  );
  const hasTopSongs = $derived((artist?.topTracks.length ?? 0) > 0);
  const hasAlbums = $derived(albums.length > 0);
  const hasSimilar = $derived((artist?.similarArtists.length ?? 0) > 0);
  /**
   * Whether the answer says the stored data covers the page; an incomplete
   * page keeps its empty sections as placeholders.
   */
  const complete = $derived(artist?.complete !== false || stalled);
  const showsTopSongs = $derived(hasTopSongs || !complete);
  const showsAlbums = $derived(hasAlbums || !complete);
  const showsSimilar = $derived(hasSimilar || !complete);
  const showsEmptyLine = $derived(complete && !hasTopSongs && !hasAlbums && !hasSimilar);
  const links = $derived(artistLinks(artist?.links ?? []));
  const opinion = $derived({
    id: artistId,
    liked: artist?.liked ?? false,
    disliked: artist?.disliked ?? false,
    rating: artist?.rating ?? 0
  });

  $effect(() => {
    const id = artistId;
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
    const id = artistId;
    const answer = artist;
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
    const id = artistId;
    if (resync === seenResync || id === '') {
      return;
    }
    seenResync = resync;
    untrack(() => void reload(id, generation));
  });

  // The indexer stored more about this artist: read the page once more, without
  // touching the page's own loading and failure state.
  $effect(() => {
    const id = artistId;
    if (id === '') {
      return;
    }
    return events.on('entity.updated', (event) => {
      if (event.data.kind !== 'artist' || event.data.id !== id) {
        return;
      }
      void reload(id, generation);
    });
  });

  /** Returns to the page that opened the artist. */
  function back(): void {
    goBack('/library/artists');
  }

  /**
   * Reads the artist's page.
   *
   * @param id The artist's client id or a merged-away id.
   * @param mine The generation of this read.
   */
  async function load(id: string, mine: number): Promise<void> {
    loading = true;
    failure = null;
    artist = null;
    try {
      const answer = await loadArtist(id);
      if (mine !== generation) {
        return;
      }
      artist = answer;
      if (answer !== null) {
        availability.remember(answer.topTracks);
        membership.remember([answer, ...answer.albums, ...answer.similarArtists]);
      }
    } catch {
      if (mine === generation) {
        failure = 'The server did not answer.';
        artist = null;
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
   * @param id The artist's client id.
   * @param mine The generation this read belongs to.
   */
  async function reload(id: string, mine: number): Promise<void> {
    let answer: ArtistPage | null;
    try {
      answer = await loadArtist(id);
    } catch {
      return;
    }
    if (mine !== generation || answer === null) {
      return;
    }
    artist = answer;
    availability.remember(answer.topTracks);
    membership.remember([answer, ...answer.albums, ...answer.similarArtists]);
  }

  /**
   * Queues the artist's collection and starts at its head.
   *
   * @param shuffle Whether to switch the player's shuffled order on.
   */
  async function playCollection(shuffle: boolean): Promise<void> {
    try {
      const collection = await loadCollection(`artist:${artistId}`);
      if (collection === null || collection.items.length === 0) {
        toasts.push('Nothing to play yet.');
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
   * Plays one of the previewed top songs, with the preview as the queue.
   *
   * @param id The track to play.
   */
  function playTrack(id: string): void {
    const rows = artist?.topTracks ?? [];
    const index = rows.findIndex((track) => track.id === id);
    if (rows.length > 0) {
      player.play(
        rows.map((track) => queueItemOf(songOf(track))),
        Math.max(0, index)
      );
    }
  }

  /** Queues a metadata refresh for this artist. */
  async function refresh(): Promise<void> {
    try {
      await refreshEntity(artistId);
      toasts.push('Metadata refresh queued.');
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? error.message
          : 'Could not refresh this artist.',
        'error'
      );
    }
  }
</script>

<svelte:head>
  <title>{artist?.name ?? 'Artist'} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load(artistId, ++generation)}>Retry</Button>
{/snippet}

{#snippet artwork()}
  <CoverArt coverArt={artist?.hasImage === true ? artist.id : null} icon="adwaita-artist" />
{/snippet}

{#snippet heroActions()}
  {#if artist !== null}
    <button
      class="hs-play-button hs-play-button--large"
      type="button"
      aria-label="Play {artist.name}"
      onclick={() => void playCollection(false)}
    >
      <Icon name="adwaita-play" />
    </button>
    <Button
      variant="flat"
      shape="icon"
      icon="adwaita-shuffle"
      label="Shuffle"
      onclick={() => void playCollection(true)}
    />
    <FeedbackControls entity={opinion} variant="like" />
    <Menu label="More Actions">
      <div class="hs-song-menu__rating-line">
        <span>Rating</span>
        <FeedbackControls entity={opinion} variant="stars" menuItem />
      </div>
      <MenuSeparator />
      <SaveButton entity={{ id: artistId, inLibrary: artist.inLibrary }} />
      {#if session.isAdmin}
        <MenuSeparator />
        <MenuItem label="Refresh Metadata" icon="adwaita-refresh" onselect={() => void refresh()} />
      {/if}
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
      <div class="top-header"><Skeleton width="120px" height="19px" /></div>
      <ul class="hs-track-list hs-track-list--no-album top-list">
        <TrackRowPlaceholders count={TOP_SONGS_PREVIEW} />
      </ul>
      <div class="albums-header"><Skeleton width="96px" height="19px" /></div>
      <div class="hs-card-grid album-grid">
        <CardPlaceholders count={ALBUM_PLACEHOLDERS} />
      </div>
    </div>
  {:else if artist === null}
    <div class="state">
      <StatusPage
        icon="adwaita-artist"
        title="Artist Not Found"
        text="It may have been removed, or the link is wrong."
      />
    </div>
  {:else}
    <Hero title={artist.name} {artwork} round bio={artist.biography ?? ''} actions={heroActions} />

    {#if links.length > 0}
      <nav class="links" aria-label="External links">
        {#each links as link (link.url)}
          <a class="hs-link" href={link.url} target="_blank" rel="noopener noreferrer"
            >{link.label}</a
          >
        {/each}
      </nav>
    {/if}

    {#if showsEmptyLine}
      <p class="artist-empty">Nothing by this artist yet.</p>
    {:else}
      {#if showsTopSongs}
        <div class="top-header">
          <SectionHeader title="Top Songs" href={topSongsHref(artist.id)} level={2} />
        </div>
        <ul class="hs-track-list hs-track-list--no-album top-list">
          {#if hasTopSongs}
            {#each artist.topTracks as track (track.id)}
              {@const song = songOf(track)}
              <SongRow
                {song}
                context="no-album"
                second="album"
                play={(picked) => playTrack(picked.id)}
                libraryMark
              />
            {/each}
          {:else}
            <TrackRowPlaceholders count={TOP_SONGS_PREVIEW} />
          {/if}
        </ul>
      {/if}

      {#if showsAlbums}
        <div class="albums-header">
          <SectionHeader title="Albums" level={2} />
        </div>
        <div class="hs-card-grid album-grid">
          {#if hasAlbums}
            {#each albums as album (album.id)}
              <AlbumCard {album} subtitle={albumCardSubtitle(album)} libraryMark />
            {/each}
          {:else}
            <CardPlaceholders count={ALBUM_PLACEHOLDERS} />
          {/if}
        </div>
      {/if}

      {#if showsSimilar}
        <div class="similar">
          <Shelf title="Similar Artists">
            {#if hasSimilar}
              {#each artist.similarArtists.slice(0, 12) as similar (similar.id)}
                <ArtistCard artist={similar} libraryMark />
              {/each}
            {:else}
              <CardPlaceholders artist count={SIMILAR_PLACEHOLDERS} />
            {/if}
          </Shelf>
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

  /* The links row sits under the hero on the content line, one flat link per
     page with the package's own link tone. */
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--hs-space-3);
    padding: 0 var(--hs-space-3) var(--hs-space-4);
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

  .similar {
    padding: 0 var(--hs-space-3) var(--hs-space-7);
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

    .links {
      padding: 0 var(--hs-space-1) var(--hs-space-3);
    }

    .top-header,
    .albums-header {
      margin-inline: calc(-1 * var(--hs-space-1));
      padding: var(--hs-space-3) 0 6px;
    }

    .top-list {
      margin-inline: calc(-1 * var(--hs-space-3));
    }

    .album-grid,
    .similar {
      padding: var(--hs-space-3) var(--hs-space-1) 18px;
    }

    .artist-empty {
      padding: 0 var(--hs-space-1) 18px;
    }
  }
</style>
