<!--
  Home (pages.md 4, p07, l13).

  The landing page at `/`: the "Home" title, then the enabled sections in the
  browser's order (l13c E1). Album, artist and playlist sections are one
  sideways shelf under a k33 title that opens the section's full list; song
  sections are five k12 rows. A section without items is hidden, so a library
  with no music shows the "Nothing to Show Yet" status page instead (p07c),
  with an upload action only for an account that may upload (o06).

  Every section is read on its own and drawn as soon as its own answer arrives,
  with a placeholder shelf for the sections still on their way: a Discovery
  shelf that waits on a listening service, or refreshes from one, never holds up
  Recently Played, Recently Added or the Liked shelves. Before the first read
  starts the page shows three placeholder shelves (p07). The page-wide o03
  status page with Retry is what a server that answered nothing leaves; a
  section that alone could not be read is left out and read again on the next
  refresh, and a failed refresh keeps what is already drawn. The Discovery
  shelves draw what the listening services answer - recommended albums, albums
  of similar artists and the playlists a service generated - and Mood Playlists
  has no source, so it stays hidden without placeholder data.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import { albumLabels } from '#lib/library/editions';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import { canUpload } from '#lib/nav';
  import { navContext } from '#lib/nav-context';
  import { navigate } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { coverArtUrl } from '#lib/player/stream';
  import { queueItemOf } from '#lib/player/tracks';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { events } from '#lib/stores/events.svelte';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import type { Song } from '#lib/library/song';
  import type { Playlist } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import PlaylistCard from '#lib/ui/PlaylistCard.svelte';
  import SectionHeader from '#lib/ui/SectionHeader.svelte';
  import Shelf from '#lib/ui/Shelf.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  import { HOME_SHELF_SIZE, HOME_SONG_ROWS, createHomeShelfReader, type HomeContent } from './data';
  import { homeLayout } from './layout.svelte';
  import { discoverySectionIds, type HomeSection } from './sections';

  /** How many placeholder shelves the first frame draws (p07). */
  const PLACEHOLDER_SHELVES = 3;

  /** How many placeholder cards one placeholder shelf draws (p07). */
  const PLACEHOLDER_CARDS = 8;

  /** Which shelves a read touches: the whole page, or the Discovery ones. */
  type ReloadScope = 'all' | 'discovery';

  const shell = getShellNavigation();
  const preferences = homeLayout();

  /** The content of every section that answered, keyed by section id. */
  let contents = $state<Record<string, HomeContent>>({});
  /** The sections of the first read that have not answered yet. */
  let pending = $state<string[]>([]);
  /** The page-wide failure, when no section of the first read answered. */
  let failure = $state<string | null>(null);
  /** Whether a read has been attempted, so the first frame keeps its placeholders. */
  let attempted = $state(false);
  /** Whether a section has answered, so a refresh never blanks the page. */
  let loaded = $state(false);

  let generation = 0;
  let reloadTimer: ReturnType<typeof setTimeout> | undefined;
  /** The scope of a reload deferred because the tab was hidden. */
  let deferredScope: ReloadScope | undefined;
  /** How many automatic reads followed a failed first one. */
  let retries = 0;

  const mayUpload = $derived(canUpload(navContext(session)));

  /** The enabled sections, in the browser's order. */
  const enabled = $derived(preferences.shown);

  /** The sections to draw: those with items, and the placeholders of the first read. */
  const shelves = $derived(
    enabled.filter((section) => pending.includes(section.id) || !isEmpty(section))
  );

  /** Whether a section of the first read is still on its way. */
  const reading = $derived(pending.length > 0);

  /**
   * Tells whether a section's loaded answer holds no items.
   *
   * @param section The section to look at.
   * @returns `true` when the section would draw nothing.
   */
  function isEmpty(section: HomeSection): boolean {
    const content = contents[section.id];
    if (content === undefined) {
      return true;
    }
    if (section.kind === 'artist') {
      return content.artists.length === 0;
    }
    if (section.kind === 'song') {
      return content.songs.length === 0;
    }
    if (section.kind === 'playlist') {
      return content.playlists.length === 0;
    }
    return content.albums.length === 0;
  }

  /**
   * Names a section's shelf.
   *
   * Because You Listen to carries the seed artist's name once the server named
   * one; every other shelf keeps its own title.
   *
   * @param section The section the shelf draws.
   * @returns The title the k33 header shows.
   */
  function shelfTitle(section: HomeSection): string {
    return contents[section.id]?.title ?? section.title;
  }

  /**
   * Names the cover a generated playlist's card draws.
   *
   * The playlist list carries the cover id the server answers `getCoverArt`
   * with, so a shelf of twenty playlists asks for no extra reads.
   *
   * @param playlist The playlist to cover.
   * @returns The one cover URL, or an empty list for the placeholder tile.
   */
  function playlistCovers(playlist: Playlist): string[] {
    return playlist.coverArt === undefined ? [] : [coverArtUrl(playlist.coverArt, 300)];
  }

  /**
   * Reads the enabled sections, each one on its own.
   *
   * A shelf is drawn as soon as its read answers; the sections still on their
   * way keep a placeholder shelf. A refresh keeps what is already drawn: the
   * placeholders belong to the first read only, and a section that fails then
   * leaves its last answer in place rather than blanking the page. The library
   * scan after first-run setup announces changes every few seconds while it
   * runs, and flipping the whole page on each announcement made the first
   * minute unusable.
   *
   * A `discovery` read touches only the shelves the listening services fill. The
   * indexer stores an artist or an album every second or two during a first
   * scan, and those shelves hold stored rows; re-reading the rest of the page
   * would draw a new `random` album and song list each time, so the reader's
   * Random Albums and Random Songs reshuffled while they looked at them.
   *
   * @param scope Which shelves to read: the whole page, or the Discovery ones.
   */
  async function load(scope: ReloadScope = 'all'): Promise<void> {
    const mine = ++generation;
    const sections = scope === 'discovery' ? discoverySections() : enabled;
    const readShelf = createHomeShelfReader(HOME_SHELF_SIZE);
    attempted = true;
    if (!loaded) {
      failure = null;
      pending = sections.map((section) => section.id);
    }
    const answered = await Promise.all(
      sections.map(async (section) => {
        try {
          const content = await readShelf(section.id);
          if (mine !== generation) {
            return false;
          }
          contents = { ...contents, [section.id]: content };
          loaded = true;
          return true;
        } catch {
          return false;
        } finally {
          if (mine === generation) {
            pending = pending.filter((id) => id !== section.id);
          }
        }
      })
    );
    if (mine !== generation) {
      return;
    }
    if (answered.some((ok) => ok)) {
      retries = 0;
      return;
    }
    if (!loaded) {
      failure = 'The server did not answer.';
      scheduleRetry();
    }
  }

  /** The enabled Discovery sections, which are the only ones an indexer event re-reads. */
  function discoverySections(): HomeSection[] {
    const ids = discoverySectionIds(enabled.map((section) => section.id));
    return enabled.filter((section) => ids.includes(section.id));
  }

  /**
   * Schedules one read after a burst of changes settles.
   *
   * A hidden tab records the read and takes it when the reader comes back: a
   * background tab has nobody looking at it, and the reads it would make are
   * reads the server does not have to serve.
   *
   * @param scope Which shelves to read.
   * @param delayMs How long to wait for the burst to settle.
   */
  function scheduleReload(scope: ReloadScope, delayMs: number): void {
    clearTimeout(reloadTimer);
    if (document.visibilityState === 'hidden') {
      deferredScope = deferredScope === 'all' || scope === 'all' ? 'all' : scope;
      return;
    }
    reloadTimer = setTimeout(() => void load(scope), delayMs);
  }

  /**
   * Tries the first read again while nothing has been drawn yet.
   *
   * The scan that follows the first library folder keeps the server busy for a
   * few seconds; the page would otherwise sit on the failure until the reader
   * reloads it. The error page stays visible between attempts, so no
   * placeholder flashes (p07).
   */
  function scheduleRetry(): void {
    if (retries >= 10) {
      return;
    }
    retries += 1;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => void load(), 2000);
  }

  /** Reads again after the reader asked, from scratch. */
  function retry(): void {
    retries = 0;
    void load();
  }

  onMount(() => {
    untrack(() => void load());
    // A like, an unlike or an upload changes what the shelves hold; the scan
    // that runs during setup announces changes in bursts, and a whole page read
    // is worth a longer wait than the Discovery shelves are.
    const offChanged = events.on('library.changed', () => scheduleReload('all', 1500));
    // The Discovery shelves are stored rows the indexer fills, so an artist or
    // album it finished is what makes one appear: a shelf whose artists were
    // just indexed would otherwise stay hidden until the reader reloads Home.
    // Only those shelves are read - the rest of the page is drawn from the
    // library, and re-reading it drew a new random list every second.
    const offArtist = events.on('entity.updated', (event) => {
      if (event.data.kind === 'artist' || event.data.kind === 'album') {
        scheduleReload('discovery', 5000);
      }
    });
    // A tab that comes back takes the read it skipped while it was hidden.
    const onVisible = () => {
      if (document.visibilityState !== 'hidden' && deferredScope !== undefined) {
        const scope = deferredScope;
        deferredScope = undefined;
        scheduleReload(scope, 0);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      offChanged();
      offArtist();
      document.removeEventListener('visibilitychange', onVisible);
      clearTimeout(reloadTimer);
    };
  });

  // A stream that lost events re-reads the whole page: a Discovery shelf's
  // answer may have been among them.
  let seenResync = $state(events.resync);
  $effect(() => {
    const resync = events.resync;
    if (resync === seenResync) {
      return;
    }
    seenResync = resync;
    untrack(() => scheduleReload('all', 0));
  });

  /**
   * Queues a song shelf's tracks and starts at the row that was picked.
   *
   * Liked Songs queues the whole liked collection through the server's
   * collection queue, so a press near the top still plays every liked track;
   * Random Songs queues the draw Home loaded.
   *
   * @param section The song section the row belongs to.
   * @param song The picked track.
   */
  async function playSong(section: HomeSection, song: Song): Promise<void> {
    if (section.id === 'liked-songs') {
      try {
        const collection = await loadCollection('liked', song.id);
        if (collection !== null && collection.items.length > 0) {
          player.play(collection.items, collection.startIndex);
        }
      } catch (error) {
        toasts.push(
          error instanceof Error && error.message !== ''
            ? `Could not play these songs: ${error.message}`
            : 'Could not play these songs.',
          'error'
        );
      }
      return;
    }
    const songs = contents[section.id]?.songs ?? [];
    const index = songs.findIndex((entry) => entry.id === song.id);
    player.play(songs.map(queueItemOf), index < 0 ? 0 : index);
  }
</script>

<svelte:head>
  <title>Home - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={retry}>Retry</Button>
{/snippet}

{#snippet uploadAction()}
  <Button icon="custom-upload" onclick={() => void navigate('/library/uploads')}>
    Upload Songs
  </Button>
{/snippet}

{#snippet placeholderShelf()}
  <section class="hs-home-section" aria-hidden="true">
    <div class="hs-section-header">
      <Skeleton width="160px" height="20px" />
    </div>
    <div class="hs-shelf">
      {#each Array.from({ length: PLACEHOLDER_CARDS }, (_, index) => index) as card (card)}
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
  </section>
{/snippet}

<PageHeader title="Home" class="home-header" onnavigation={shell?.openNavigation} />

{#if failure !== null}
  <div class="state">
    <StatusPage
      level={2}
      alert
      icon="adwaita-error"
      title="Could Not Load This Page"
      text="The server did not answer. Try again in a moment."
      action={retryAction}
    />
  </div>
{:else if !attempted}
  <div class="hs-home home" aria-busy="true">
    <span class="hs-visually-hidden" role="status">Loading...</span>
    {#each Array.from({ length: PLACEHOLDER_SHELVES }, (_, index) => index) as shelf (shelf)}
      {@render placeholderShelf()}
    {/each}
  </div>
{:else if shelves.length === 0}
  <div class="state">
    <StatusPage
      level={2}
      icon="adwaita-home"
      title="Nothing to Show Yet"
      text="Music you add, play and like fills this page."
      action={mayUpload ? uploadAction : undefined}
    />
  </div>
{:else}
  <div class="hs-home home" aria-busy={reading ? 'true' : undefined}>
    {#if reading}
      <span class="hs-visually-hidden" role="status">Loading...</span>
    {/if}
    {#each shelves as section (section.id)}
      {#if pending.includes(section.id)}
        {@render placeholderShelf()}
      {:else if section.kind === 'song'}
        <section class="hs-home-section" aria-label={section.title}>
          <SectionHeader title={section.title} href={`/home/${section.id}`} />
          <ul class="hs-track-list songs">
            {#each (contents[section.id]?.songs ?? []).slice(0, HOME_SONG_ROWS) as song (song.id)}
              <SongRow {song} play={(picked) => void playSong(section, picked)} />
            {/each}
          </ul>
        </section>
      {:else if section.kind === 'artist'}
        <Shelf title={shelfTitle(section)} href={`/home/${section.id}`}>
          {#each contents[section.id]?.artists ?? [] as artist (artist.id)}
            <ArtistCard {artist} />
          {/each}
        </Shelf>
      {:else if section.kind === 'playlist'}
        <Shelf title={shelfTitle(section)} href={`/home/${section.id}`}>
          {#each contents[section.id]?.playlists ?? [] as playlist (playlist.id)}
            <PlaylistCard
              name={playlist.name}
              songs={playlist.songCount ?? 0}
              href={`/playlist/${playlist.id}`}
              covers={playlistCovers(playlist)}
            />
          {/each}
        </Shelf>
      {:else}
        {@const labels = albumLabels(contents[section.id]?.albums ?? [])}
        <Shelf title={shelfTitle(section)} href={`/home/${section.id}`}>
          {#each contents[section.id]?.albums ?? [] as album (album.id)}
            <AlbumCard
              {album}
              title={labels.titles.get(album.id)}
              subtitle={labels.subtitles.get(album.id)}
            />
          {/each}
        </Shelf>
      {/if}
    {/each}
  </div>
{/if}

<style>
  /* Layout glue only: the page hands its column over unpadded (see the shell),
     so the header keeps the 24 px the other pages get from the page and the
     shelves keep the package's own Home inset from the view edge. */
  :global(.home-header) {
    padding-inline: var(--hs-space-6);
  }

  /* The empty and error states fill the content column, so the k22 page sits
     in the middle of it rather than directly under the title. */
  .state {
    display: flex;
    flex-direction: column;
    min-height: 60vh;
  }

  /* The package's shelves and their headers carry the approved 32 px Home
     inset already; nothing may overhang the column, which used to make the
     content wider than the page and give the window a second scrollbar. */
  .home {
    min-width: 0;
  }

  /* A song shelf's k12 list takes the page margin, so its cover sits on the
     board's line (24 px plus the row's own 6 px lead inset). */
  .home :global(.songs) {
    margin: 0;
    padding: 0 var(--hs-space-6);
    list-style: none;
  }

  @media (max-width: 720px) {
    :global(.home-header) {
      padding-inline: var(--hs-space-5);
    }

    .home :global(.songs) {
      padding: 0 var(--hs-space-5);
    }
  }
</style>
