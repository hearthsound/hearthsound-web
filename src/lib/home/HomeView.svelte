<!--
  Home (pages.md 4, p07, l13).

  The landing page at `/`: the "Home" title, then the enabled sections in the
  browser's order (l13c E1). Album and artist sections are one sideways shelf
  under a k33 title that opens the section's full list; song sections are five
  k12 rows. A section without items is hidden, so a library with no music shows
  the "Nothing to Show Yet" status page instead (p07c), with an upload action
  only for an account that may upload (o06).

  Loading is three placeholder shelves (p07). A read the server did not answer
  is the page-wide o03 status page with Retry; the page never shows a partial
  set of shelves over a failed read. The sections the Discovery layer supplies
  later - Recommended Albums, Because You Listen to, Generated Playlists and
  Mood Playlists - have no source today and answer with nothing, so they stay
  hidden without placeholder data.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import { canUpload } from '#lib/nav';
  import { navigate } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { events } from '#lib/stores/events.svelte';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import type { Child } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import SectionHeader from '#lib/ui/SectionHeader.svelte';
  import Shelf from '#lib/ui/Shelf.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  import { HOME_SHELF_SIZE, HOME_SONG_ROWS, loadHomeShelves, type HomeContent } from './data';
  import { homeLayout } from './layout.svelte';
  import { HOME_SECTIONS, type HomeSection } from './sections';

  /** How many placeholder shelves the loading state draws (p07). */
  const PLACEHOLDER_SHELVES = 3;

  /** How many placeholder cards one loading shelf draws (p07). */
  const PLACEHOLDER_CARDS = 8;

  const shell = getShellNavigation();
  const preferences = homeLayout();

  /** The items of every section, loaded together. */
  let contents = $state<Record<string, HomeContent>>({});
  let loading = $state(true);
  let failure = $state<string | null>(null);

  let generation = 0;

  const mayUpload = $derived(
    canUpload({
      isAdmin: session.isAdmin,
      systemInfo: session.systemInfo,
      user: session.user
    })
  );

  /** The enabled sections that hold something, in the browser's order. */
  const shelves = $derived(preferences.shown.filter((section) => !isEmpty(section)));

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
      // No playlist source exists before the Discovery layer (M6), so a
      // playlist shelf stays hidden rather than drawing invented cards.
      return true;
    }
    return content.albums.length === 0;
  }

  /** Reads every section; the sections are read together so the page has one
   * loaded state and one failure state. */
  async function load(): Promise<void> {
    const mine = ++generation;
    loading = true;
    failure = null;
    try {
      const answer = await loadHomeShelves(
        HOME_SECTIONS.map((section) => section.id),
        HOME_SHELF_SIZE
      );
      if (mine !== generation) {
        return;
      }
      contents = answer;
    } catch {
      if (mine === generation) {
        contents = {};
        failure = 'The server did not answer.';
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  onMount(() => {
    untrack(() => void load());
    // A like, an unlike or an upload changes what the shelves hold.
    return events.on('library.changed', () => void load());
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
  async function playSong(section: HomeSection, song: Child): Promise<void> {
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
  <Button onclick={() => void load()}>Retry</Button>
{/snippet}

{#snippet uploadAction()}
  <Button icon="custom-upload" onclick={() => void navigate('/library/uploads')}>
    Upload Songs
  </Button>
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
{:else if loading}
  <div class="hs-home home" aria-busy="true">
    <span class="hs-visually-hidden" role="status">Loading...</span>
    {#each Array.from({ length: PLACEHOLDER_SHELVES }, (_, index) => index) as shelf (shelf)}
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
  <div class="hs-home home">
    {#each shelves as section (section.id)}
      {#if section.kind === 'song'}
        <section class="hs-home-section" aria-label={section.title}>
          <SectionHeader title={section.title} href={`/home/${section.id}`} />
          <ul class="hs-track-list songs">
            {#each (contents[section.id]?.songs ?? []).slice(0, HOME_SONG_ROWS) as song (song.id)}
              <SongRow {song} play={(picked) => void playSong(section, picked)} />
            {/each}
          </ul>
        </section>
      {:else if section.kind === 'artist'}
        <Shelf title={section.title} href={`/home/${section.id}`}>
          {#each contents[section.id]?.artists ?? [] as artist (artist.id)}
            <ArtistCard {artist} />
          {/each}
        </Shelf>
      {:else}
        <Shelf title={section.title} href={`/home/${section.id}`}>
          {#each contents[section.id]?.albums ?? [] as album (album.id)}
            <AlbumCard {album} />
          {/each}
        </Shelf>
      {/if}
    {/each}
  </div>
{/if}

<style>
  /* Layout glue only: the shell already holds the page off the window edge, so
     the header aligns to that margin and the shelves add their own Home inset. */
  :global(.home-header) {
    padding-inline: 0;
  }

  /* The empty and error states fill the content column, so the k22 page sits
     in the middle of it rather than directly under the title. */
  .state {
    display: flex;
    flex-direction: column;
    min-height: 60vh;
  }

  /* The shell holds the page 24 px off the view edge; the package's Home shelf
     adds the approved 32 px inset from the content column. Pulling the shelf
     wrapper back out by the shell's padding measures that inset from the view
     edge, as the l13 boards draw it, and leaves the "Home" title on the
     header's own margin. */
  .home {
    margin-inline: calc(-1 * var(--hs-space-6));
  }

  /* A song shelf's k33 header carries the package's 32 px Home inset; its k12
     list takes the same inset minus the row's own 6 px lead inset, so the cover
     starts on the title's line and the row's hover tile reaches the gutter. */
  .home :global(.songs) {
    margin: 0;
    padding: 0 24px 0 calc(32px - var(--hs-track-row-inset));
    list-style: none;
  }

  @media (max-width: 720px) {
    .home {
      margin-inline: calc(-1 * var(--hs-space-5));
    }

    .home :global(.songs) {
      padding: 0 14px 0 calc(14px - var(--hs-track-row-inset));
    }
  }
</style>
