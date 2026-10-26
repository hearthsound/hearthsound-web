<!--
  An artist.

  The approved artist page (p16-r1 A, l09 A): a drill-down header, the round
  portrait, the name, the biography from `getArtistInfo2` clamped to three
  lines with a Show more that opens the whole text in a dialog, the actions and
  then Top Songs and Albums. Top Songs is a k33 link header to the complete
  list and the five most played tracks, whose second line is the album; Albums
  is the k13 grid, newest first, with the release year as the card's second
  line. A section with nothing in it is left out, and an artist with neither
  gets one muted line (u1-r1). A failed top songs read is not emptiness: it
  keeps the section and offers a Retry, so a transient error never draws a
  wrong, empty artist.

  While the page reads, and while the enrichment job of the artist may still
  fill it in, the sections it does not hold yet shimmer: the hero, five song
  rows and the album cards stand in for what is coming, so a slow answer is
  never a blank page. The empty line waits for the read to finish and for the
  enrichment window to close, which is what stops an online artist from being
  drawn as an artist with nothing (u1-r1, E-G-12).

  The page is the artist's whole discography whichever path or id opened it: the
  catalog's albums with the library's own in their places, each carrying the
  library mark when the library holds it. The address carries the artist's
  readable path, and a path with a duplicate name is rewritten to the one the
  server spells. Play and Shuffle queue the artist's
  library songs through the server's collection queue (queue-scope,
  queue-api).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import CardPlaceholders from '#lib/ui/CardPlaceholders.svelte';
  import CoverArt from '#lib/components/CoverArt.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import TrackRowPlaceholders from '#lib/library/TrackRowPlaceholders.svelte';
  import FeedbackControls from '#lib/library/FeedbackControls.svelte';
  import { reportedFeedback } from '#lib/library/feedback';
  import { membership } from '#lib/library/membership.svelte';
  import { createEnrichmentWait } from '#lib/library/enrichment-wait.svelte';
  import { awaitingEnrichment, showsEmptyLine } from '#lib/library/enrichment';
  import { loadCollection } from '#lib/library/queue-source';
  import SaveButton from '#lib/library/SaveButton.svelte';
  import { goBack, replaceRoute } from '#lib/navigation';
  import { artistHrefFromPath, targetOf, topSongsHref } from '#lib/paths';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { events } from '#lib/stores/events.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import { availability } from '#lib/stores/availability.svelte';
  import { entities } from '#lib/stores/entities';
  import { libraryApi } from '#lib/subsonic/library';
  import type { ArtistWithAlbums, Child } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import Hero from '#lib/ui/Hero.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import SectionHeader from '#lib/ui/SectionHeader.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  /** How many top songs the artist page shows above Albums. */
  const TOP_SONGS_PREVIEW = 5;

  /**
   * How many album cards the page shimmers while the album list is pending: one
   * row of a wide window, so the grid has a shape before its cards arrive.
   */
  const ALBUM_PLACEHOLDERS = 6;

  /** The artist's path segment, as the address spells it. */
  const segment = $derived(page.params.artist ?? '');
  /** The artist's page path, built from the segment the address carries. */
  const route = $derived(`/artist/${encodeURIComponent(segment)}`);
  /**
   * The artist's client id, once the path or the click that opened the page
   * answered. Reads and playback use this; the address never does.
   */
  let entityId = $state('');

  let artist = $state<ArtistWithAlbums | null>(null);
  let biography = $state('');
  /** The top songs, or `null` while the read is pending. */
  let topSongs = $state<Child[] | null>(null);
  /** Whether the top songs read failed, which is not an artist without songs. */
  let topSongsFailed = $state(false);
  let failure = $state<string | null>(null);
  let loading = $state(true);
  /**
   * Whether the enrichment job of this artist has announced itself, so a page
   * that is still cold stops waiting for content.
   */
  let extrasSettled = $state(false);

  /** The bounded wait for the enrichment job, restarted by every read. */
  const enrichmentWait = createEnrichmentWait();

  let generation = 0;

  const albums = $derived(
    [...(artist?.album ?? [])].sort((left, right) => (right.year ?? 0) - (left.year ?? 0))
  );
  const hasTopSongs = $derived((topSongs?.length ?? 0) > 0);
  const hasAlbums = $derived(albums.length > 0);
  /**
   * Whether the server holds this artist, whose collection queue can be asked
   * for its songs even when the page's own reads found none.
   */
  const storedArtist = $derived(entityId.startsWith('ar_'));
  /** Whether the album list is known: a seed from a card carries only its count. */
  const albumsLoaded = $derived(artist?.album !== undefined);
  /** How many songs the albums hold, when their counts are known. */
  const songTotal = $derived(
    (artist?.album ?? []).reduce((total, album) => total + (album.songCount ?? 0), 0)
  );
  /**
   * Whether the page waits for the enrichment job of this artist: it holds no
   * top songs and no albums yet, the job has not announced itself, and the
   * window has not passed.
   */
  const awaiting = $derived(
    awaitingEnrichment({
      settled: extrasSettled,
      hasExtras: hasTopSongs || hasAlbums,
      waited: enrichmentWait.waited
    })
  );
  /**
   * The rows to draw while the top songs are pending: what the album counts
   * already promise, or the whole preview when the artist's size is unknown.
   */
  const topSongPlaceholders = $derived(
    topSongs === null && !topSongsFailed && (loading || awaiting)
      ? albumsLoaded && songTotal > 0
        ? Math.min(TOP_SONGS_PREVIEW, songTotal)
        : TOP_SONGS_PREVIEW
      : 0
  );
  /** Whether the Top Songs section is drawn: rows, placeholders, or a failed read. */
  const showsTopSongs = $derived(hasTopSongs || topSongsFailed || topSongPlaceholders > 0);
  /** The album cards to draw while the album list is pending. */
  const albumPlaceholders = $derived(!hasAlbums && (loading || awaiting) ? ALBUM_PLACEHOLDERS : 0);
  const artistFeedback = $derived(artist === null ? null : reportedFeedback(artist));
  /**
   * Whether the page may say the artist has nothing: a page that is reading, a
   * failed read and a page whose enrichment may still arrive all leave the line
   * out.
   */
  const emptyLine = $derived(
    showsEmptyLine({
      settled: extrasSettled,
      hasExtras: hasTopSongs || hasAlbums,
      waited: enrichmentWait.waited,
      loading,
      failed: topSongsFailed || failure !== null
    })
  );

  $effect(() => {
    const current = segment;
    const mine = ++generation;
    untrack(() => void load(current, mine));
  });

  // The enrichment job announces the artist it filled in; the page reads the
  // parts that can only be there now, without touching what it draws or how it
  // loaded. A page the library already filled in asks too: the job adds the
  // catalog's albums and top songs beside the stored ones, so a page holding
  // only local content is exactly the one that has to be read again.
  $effect(() => {
    const id = entityId;
    if (id === '') {
      return;
    }
    return events.on('catalog.enriched', (event) => {
      if (event.data.entityId !== id || event.data.kind !== 'artist') {
        return;
      }
      extrasSettled = true;
      void refresh(id);
    });
  });

  /** Returns to the page that opened the artist. */
  function back(): void {
    goBack('/library/artists');
  }

  /**
   * Reads the artist, its biography and its top songs.
   *
   * The path is resolved to the artist's id first: a link carries the names, a
   * click carries the id, and both name the same page. The biography and the
   * top songs are extras: a failure in either never fails the page, and the
   * top songs read reports itself in place through {@link loadTopSongs}.
   *
   * @param current The artist's path segment.
   * @param mine The generation of this read.
   */
  async function load(current: string, mine: number): Promise<void> {
    // The card that opened this page already drew the artist, so the hero is
    // there before the server answers. Its albums decide whether the page has
    // anything to show, so they are the one part that keeps the page loading;
    // the biography and the top songs fill in when they arrive.
    const remembered = targetOf(page.url.pathname);
    artist = remembered === undefined ? null : (entities.artist(remembered) ?? null);
    biography = '';
    topSongs = null;
    topSongsFailed = false;
    extrasSettled = false;
    enrichmentWait.restart();
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
        loading = false;
      }
      return;
    }
    if (mine !== generation) {
      return;
    }
    if (resolved === null) {
      artist = null;
      loading = false;
      return;
    }
    entityId = resolved.id;
    const canonical = artistHrefFromPath(resolved.path) ?? route;
    if (canonical !== route) {
      replaceRoute(canonical);
    }
    artist = entities.artist(entityId) ?? artist;

    void libraryApi
      .artistInfo(entityId)
      .catch(() => null)
      .then((info) => {
        if (mine === generation && failure === null) {
          biography = info?.biography ?? '';
        }
      });
    loadTopSongs(mine);

    try {
      const answer = await libraryApi.artist(entityId);
      if (mine !== generation) {
        return;
      }
      artist = answer;
      if (answer !== null) {
        availability.remember([answer, ...(answer.album ?? [])]);
        membership.remember([answer, ...(answer.album ?? [])]);
      }
    } catch {
      if (mine === generation) {
        failure = 'The server did not answer.';
        artist = null;
        biography = '';
        topSongs = null;
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  /**
   * Reads the parts of the artist the enrichment job filled in.
   *
   * The job has already answered; this only collects. Each answer is applied
   * when the generation still matches and the read succeeded, and nothing the
   * page already draws is cleared first: the reading, failure and loading state
   * are the page's own, and a section that is already there stays there.
   *
   * @param id The artist's client id.
   */
  async function refresh(id: string): Promise<void> {
    const mine = generation;
    const [answer, info, tops] = await Promise.allSettled([
      libraryApi.artist(id),
      libraryApi.artistInfo(id),
      libraryApi.topSongs(id, TOP_SONGS_PREVIEW)
    ]);
    if (mine !== generation) {
      return;
    }
    if (answer.status === 'fulfilled' && answer.value !== null) {
      artist = answer.value;
      availability.remember([answer.value, ...(answer.value.album ?? [])]);
      membership.remember([answer.value, ...(answer.value.album ?? [])]);
    }
    if (info.status === 'fulfilled' && (info.value?.biography ?? '') !== '') {
      biography = info.value?.biography ?? '';
    }
    if (tops.status === 'fulfilled') {
      topSongs = tops.value;
      topSongsFailed = false;
      availability.remember(tops.value);
    }
  }

  /**
   * Reads the artist's top songs.
   *
   * A failure is not an empty list: the section keeps its place and answers
   * with its own line and a Retry, so a transient error is never drawn as an
   * artist with nothing to play.
   *
   * @param mine The generation of the read this belongs to.
   */
  function loadTopSongs(mine: number): void {
    void libraryApi.topSongs(entityId, TOP_SONGS_PREVIEW).then(
      (tops) => {
        if (mine === generation && failure === null) {
          topSongs = tops;
          topSongsFailed = false;
          availability.remember(tops);
        }
      },
      () => {
        if (mine === generation && failure === null) {
          topSongs = [];
          topSongsFailed = true;
        }
      }
    );
  }

  /**
   * Reads the top songs again after a failed read.
   *
   * While the page is still reading, the whole page is read again: the failed
   * section is only one of the reads in flight, and a generation bump alone
   * would orphan the answer the page is waiting for.
   */
  function retryTopSongs(): void {
    const mine = ++generation;
    if (loading) {
      void load(segment, mine);
      return;
    }
    loadTopSongs(mine);
  }

  /**
   * Plays the artist's songs, starting at one of them.
   *
   * A stored artist is queued through the server's collection, which holds the
   * artist's library songs. A catalog artist has no such collection: the page
   * already holds its top songs, stored and catalog rows together, and those
   * rows are the queue, the way an album page queues its own tracklist.
   *
   * @param from The track to start at; absent starts at the first.
   * @param shuffle Whether to switch the player's shuffled order on.
   */
  async function playCollection(from?: string, shuffle = false): Promise<void> {
    if (entityId.startsWith('ar_')) {
      try {
        const collection = await loadCollection(`artist:${entityId}`, from);
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
      return;
    }
    const rows = topSongs ?? [];
    if (rows.length === 0) {
      toasts.push('Nothing to play yet.');
      return;
    }
    const index = from === undefined ? 0 : rows.findIndex((song) => song.id === from);
    player.play(rows.map(queueItemOf), Math.max(0, index));
    player.setShuffle(shuffle);
  }

  /**
   * Plays one of the artist's top songs, with the rows the page holds as the
   * queue.
   *
   * A catalog track goes through the acquisition flow the way any other row
   * does, which the collection queue cannot do: it holds stored ids only.
   *
   * @param song The track to play.
   */
  function playTrack(song: Child): void {
    const rows = topSongs ?? [];
    const index = rows.findIndex((row) => row.id === song.id);
    if (rows.length > 0) {
      player.play(rows.map(queueItemOf), Math.max(0, index));
    }
  }
</script>

<svelte:head>
  <title>{artist?.name ?? 'Artist'} - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load(segment, ++generation)}>Retry</Button>
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
      disabled={!storedArtist && !hasTopSongs && !hasAlbums}
      onclick={() => void playCollection(undefined, false)}
    >
      <Icon name="adwaita-play" />
    </button>
    <Button
      variant="flat"
      shape="icon"
      icon="adwaita-shuffle"
      label="Shuffle"
      disabled={!storedArtist && !hasTopSongs && !hasAlbums}
      onclick={() => void playCollection(undefined, true)}
    />
    {#if artistFeedback !== null}
      <FeedbackControls entity={artistFeedback} variant="like" />
    {/if}
    <Menu label="More Actions">
      {#if artistFeedback !== null}
        <div class="hs-song-menu__rating-line">
          <span>Rating</span>
          <FeedbackControls entity={artistFeedback} variant="stars" menuItem />
        </div>
        <MenuSeparator />
      {/if}
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
      <div class="top-header">
        <Skeleton width="120px" height="19px" />
      </div>
      <ul class="hs-track-list hs-track-list--no-album top-list">
        <TrackRowPlaceholders count={TOP_SONGS_PREVIEW} />
      </ul>
      <div class="albums-header">
        <Skeleton width="96px" height="19px" />
      </div>
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
    <Hero title={artist.name} {artwork} round bio={biography} actions={heroActions} />

    {#if emptyLine}
      <p class="artist-empty">Nothing by this artist yet.</p>
    {:else}
      {#if showsTopSongs}
        <div class="top-header">
          <SectionHeader title="Top Songs" href={topSongsHref(route)} level={2} />
        </div>
        {#if topSongsFailed}
          <div class="top-failure">
            <p>Could not load the top songs.</p>
            <Button variant="flat" onclick={retryTopSongs}>Retry</Button>
          </div>
        {:else}
          <ul class="hs-track-list hs-track-list--no-album top-list">
            {#if topSongs === null}
              <TrackRowPlaceholders count={topSongPlaceholders} />
            {:else}
              {#each topSongs as song (song.id)}
                <SongRow {song} context="no-album" second="album" play={playTrack} libraryMark />
              {/each}
            {/if}
          </ul>
        {/if}
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
              libraryMark
            />
          {/each}
        </div>
      {:else if albumPlaceholders > 0}
        <div class="albums-header">
          <SectionHeader title="Albums" level={2} />
        </div>
        <div class="hs-card-grid album-grid">
          <CardPlaceholders count={albumPlaceholders} />
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

  /* A failed top songs read is one muted sentence and a flat Retry on one row;
     no package row combines a caption with a button, and the section keeps the
     header's own padding. */
  .top-failure {
    display: flex;
    align-items: center;
    gap: var(--hs-space-3);
    padding: 0 var(--hs-space-3) var(--hs-space-3);
  }

  .top-failure p {
    margin: 0;
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

    .top-failure {
      padding: 0 var(--hs-space-1) var(--hs-space-2);
    }
  }
</style>
