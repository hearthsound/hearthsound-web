<!--
  Search (p18 B, l14 B).

  The sidebar's pill field drives this page through `?q=`, and on phones the
  page header holds the same field after the back button (l14). The query is
  read from the address and written back to it as the reader types, so a search
  can be shared; both fields follow the one address.

  The answer is the `search3` result: the Top Result card beside the Songs
  list above 1000 px and stacked below it (p18), then the Albums and
  Artists shelves. The shelf titles are k33 links to their full-list pages
  (o04, E10). Every entity the answer carries is remembered in the availability
  store, so a catalog result the reader plays goes through the acquisition
  flow.

  The Top Result is the entity with the highest relevance score once the core
  exposes it; until then the client picks an exactly named artist, album or
  song, and otherwise the first artist, album or song (b03).

  No availability pills and no acquisition progress are drawn (privacy-scope-2).
-->
<script lang="ts">
  import { untrack } from 'svelte';
  import { page } from '$app/state';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import type { QueueSource } from '#lib/library/queue-source';
  import { navigate } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { coverArtUrl } from '#lib/player/stream';
  import { queueItemOf } from '#lib/player/tracks';
  import { returnFromSearch } from '#lib/search-navigation';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { availability } from '#lib/stores/availability.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import { subsonic } from '#lib/subsonic/client';
  import type { AlbumID3, ArtistID3, Child, Search3Response } from '#lib/subsonic/types';
  import type { IconName } from '@hearthsound/design/icons';
  import Button from '#lib/ui/Button.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import SectionHeader from '#lib/ui/SectionHeader.svelte';
  import Shelf from '#lib/ui/Shelf.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import TextField from '#lib/ui/TextField.svelte';
  import TopResultCard from '#lib/ui/TopResultCard.svelte';

  /** How many songs, albums and artists one search asks for. */
  const SONG_COUNT = 30;
  const ALBUM_COUNT = 12;
  const ARTIST_COUNT = 12;

  /** How long the page waits after the last keystroke before it searches. */
  const QUERY_DELAY_MS = 300;

  /** The size of the Top Result artwork, in pixels. */
  const TOP_RESULT_ART_SIZE = 192;

  /** The l07 breakpoint: below it the field moves into the page header (p18). */
  const PHONE_QUERY = '(max-width: 720px)';

  const shell = getShellNavigation();

  /** Whether the phone layout draws the back button and the page's own field. */
  let phone = $state(window.matchMedia(PHONE_QUERY).matches);

  /** What the field holds and what the next search asks for. */
  let query = $state(page.url.searchParams.get('q') ?? '');

  let songs = $state<Child[]>([]);
  let albums = $state<AlbumID3[]>([]);
  let artists = $state<ArtistID3[]>([]);

  /** The query whose answer is on screen, or `null` before the first answer. */
  let resultQuery = $state<string | null>(null);
  let loading = $state((page.url.searchParams.get('q') ?? '').trim() !== '');
  let failure = $state<string | null>(null);

  let generation = 0;

  /** The query this page last wrote to the address, while the write lands. */
  let publishing: string | null = null;

  /** One entity the Top Result card can show (p18, b03). */
  interface TopResult {
    /** The entity's name. */
    name: string;
    /** Its kind, "Artist", "Album" or "Song". */
    kind: string;
    /** The artist the muted line names. */
    artist: string;
    /** Its page, when it has one. */
    href?: string;
    /** Its artwork, when it has one. */
    art?: string;
    /** The tile shown for missing artwork. */
    icon: IconName;
    /** Starts the entity. */
    play: () => void;
  }

  $effect(() => {
    const media = window.matchMedia(PHONE_QUERY);
    const update = (): void => {
      phone = media.matches;
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });

  // The address is the query's other half: the sidebar field, a shared link,
  // Back and Forward all arrive as a new `q`. A value this page wrote is not
  // adopted again, so a keystroke typed while the write lands is kept.
  $effect(() => {
    const pathname = page.url.pathname;
    const asked = page.url.searchParams.get('q') ?? '';
    if (pathname !== '/search') {
      return;
    }
    const mine = publishing;
    publishing = null;
    untrack(() => {
      if (mine !== null && asked === mine) {
        return;
      }
      if (query !== asked) {
        query = asked;
      }
    });
  });

  // The page searches a pause after the last keystroke, and writes the same
  // query to the address so the results can be shared.
  $effect(() => {
    const text = query.trim();
    const mine = ++generation;
    if (text === '') {
      songs = [];
      albums = [];
      artists = [];
      resultQuery = null;
      failure = null;
      loading = false;
      return;
    }
    loading = true;
    failure = null;
    const timer = setTimeout(() => {
      publish(text);
      void search(text, mine);
    }, QUERY_DELAY_MS);
    return () => clearTimeout(timer);
  });

  /** The entity the Top Result card shows, or `null` before an answer (b03). */
  const topResult = $derived(topOf(songs, albums, artists, resultQuery));

  /** The shelf link to the full album list for the answer on screen. */
  const albumList = $derived(
    resultQuery === null ? null : `/search/albums?q=${encodeURIComponent(resultQuery)}`
  );

  /** The shelf link to the full artist list for the answer on screen. */
  const artistList = $derived(
    resultQuery === null ? null : `/search/artists?q=${encodeURIComponent(resultQuery)}`
  );

  /**
   * Writes the query to the address, replacing the previous search entry.
   *
   * @param text The trimmed query.
   */
  function publish(text: string): void {
    if ((page.url.searchParams.get('q') ?? '') === text) {
      return;
    }
    publishing = text;
    void navigate(`/search?q=${encodeURIComponent(text)}`, { replaceState: true });
  }

  /**
   * Runs one search and renders its answer, unless a newer one started.
   *
   * @param text The query to search for.
   * @param mine The generation of this search.
   */
  async function search(text: string, mine: number): Promise<void> {
    try {
      const answer = await subsonic.get<Search3Response>('search3', {
        query: text,
        songCount: SONG_COUNT,
        albumCount: ALBUM_COUNT,
        artistCount: ARTIST_COUNT
      });
      if (mine !== generation) {
        return;
      }
      const result = answer.searchResult3 ?? {};
      songs = result.song ?? [];
      albums = result.album ?? [];
      artists = result.artist ?? [];
      availability.remember([...songs, ...albums, ...artists]);
      resultQuery = text;
      failure = null;
      loading = false;
    } catch (error) {
      if (mine !== generation) {
        return;
      }
      songs = [];
      albums = [];
      artists = [];
      resultQuery = null;
      failure = error instanceof Error ? error.message : 'The search could not be run.';
      loading = false;
    }
  }

  /** Retries the query that failed (o03). */
  function retry(): void {
    const text = query.trim();
    if (text === '') {
      return;
    }
    const mine = ++generation;
    loading = true;
    failure = null;
    void search(text, mine);
  }

  /**
   * Plays one of the found tracks, with the rest of the results as the queue.
   *
   * @param song The track to play.
   */
  function play(song: Child): void {
    const index = songs.findIndex((entry) => entry.id === song.id);
    player.play(songs.map(queueItemOf), index < 0 ? 0 : index);
  }

  /**
   * Queues a collection and starts at its head.
   *
   * @param source The collection to queue.
   * @param what The entity kind, for the failure toast.
   */
  async function playCollection(source: QueueSource, what: string): Promise<void> {
    try {
      const collection = await loadCollection(source);
      if (collection !== null && collection.items.length > 0) {
        player.play(collection.items, collection.startIndex);
      }
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not play this ${what}: ${error.message}`
          : `Could not play this ${what}.`,
        'error'
      );
    }
  }

  /**
   * Empties the page's own field and returns to the page before it.
   *
   * @param event The input event that emptied the field.
   */
  function typed(event: Event): void {
    if ((event.currentTarget as HTMLInputElement).value.trim() === '') {
      returnFromSearch();
    }
  }

  /**
   * Escape in the phone page's field returns to the page before the search.
   *
   * @param event The key press.
   */
  function fieldKey(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    returnFromSearch();
  }

  /**
   * Normalises a name for the b03 equality test: case and accents ignored.
   *
   * @param value The name or the query.
   * @returns The comparable form.
   */
  function accentFree(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .trim();
  }

  /**
   * The track's name.
   *
   * @param song The track.
   * @returns Its title, or its name.
   */
  function songName(song: Child): string {
    return song.title ?? song.name ?? '';
  }

  /**
   * The entity a search answer promotes to the Top Result (b03).
   *
   * @param songs The matching tracks.
   * @param albums The matching albums.
   * @param artists The matching artists.
   * @param asked The query the answer belongs to.
   * @returns The card's entity, or `null` before an answer.
   */
  function topOf(
    songs: Child[],
    albums: AlbumID3[],
    artists: ArtistID3[],
    asked: string | null
  ): TopResult | null {
    if (asked === null) {
      return null;
    }
    const wanted = accentFree(asked);
    const equals = (name: string | undefined): boolean => accentFree(name ?? '') === wanted;

    const artist = artists.find((entry) => equals(entry.name));
    if (artist !== undefined) {
      return artistResult(artist);
    }
    const album = albums.find((entry) => equals(entry.name));
    if (album !== undefined) {
      return albumResult(album);
    }
    const song = songs.find((entry) => equals(songName(entry)));
    if (song !== undefined) {
      return songResult(song);
    }
    if (artists[0] !== undefined) {
      return artistResult(artists[0]);
    }
    if (albums[0] !== undefined) {
      return albumResult(albums[0]);
    }
    if (songs[0] !== undefined) {
      return songResult(songs[0]);
    }
    return null;
  }

  /**
   * Builds the card for an artist.
   *
   * @param artist The artist.
   * @returns The card's entity.
   */
  function artistResult(artist: ArtistID3): TopResult {
    return {
      name: artist.name,
      kind: 'Artist',
      artist: artist.name,
      href: `/artist/${artist.id}`,
      art: artOf(artist.coverArt),
      icon: 'adwaita-artist',
      play: () => void playCollection(`artist:${artist.id}`, 'artist')
    };
  }

  /**
   * Builds the card for an album.
   *
   * @param album The album.
   * @returns The card's entity.
   */
  function albumResult(album: AlbumID3): TopResult {
    return {
      name: album.name,
      kind: 'Album',
      artist: album.artist ?? '',
      href: `/album/${album.id}`,
      art: artOf(album.coverArt),
      icon: 'adwaita-album',
      play: () => void playCollection(`album:${album.id}`, 'album')
    };
  }

  /**
   * Builds the card for a song; its link opens the album or artist page.
   *
   * @param song The track.
   * @returns The card's entity.
   */
  function songResult(song: Child): TopResult {
    return {
      name: songName(song),
      kind: 'Song',
      artist: song.artist ?? '',
      href:
        song.albumId !== undefined && song.albumId !== ''
          ? `/album/${song.albumId}`
          : song.artistId !== undefined && song.artistId !== ''
            ? `/artist/${song.artistId}`
            : undefined,
      art: artOf(song.coverArt),
      icon: 'adwaita-song',
      play: () => play(song)
    };
  }

  /**
   * The artwork URL of a cover id.
   *
   * @param coverArt The `getCoverArt` id, when there is one.
   * @returns The URL, or `undefined` for the placeholder.
   */
  function artOf(coverArt: string | undefined): string | undefined {
    return coverArt === undefined || coverArt === ''
      ? undefined
      : coverArtUrl(coverArt, TOP_RESULT_ART_SIZE);
  }
</script>

<svelte:head>
  <title>Search - Hearthsound</title>
</svelte:head>

{#snippet pageField()}
  <TextField
    kind="search"
    label="Search"
    placeholder="Song, album or artist"
    bind:value={query}
    oninput={typed}
    onclear={returnFromSearch}
    onkeydown={fieldKey}
  />
{/snippet}

{#snippet retryAction()}
  <Button onclick={retry}>Retry</Button>
{/snippet}

{#snippet rowPlaceholders(count: number)}
  {#each Array.from({ length: count }, (_, index) => index) as row (row)}
    <li class="hs-track-row" aria-hidden="true">
      <span class="hs-track-row__lead">
        <Skeleton width="40px" height="40px" radius="art-small" />
      </span>
      <span class="hs-track-row__text">
        <Skeleton width="60%" height="12px" />
        <Skeleton width="35%" height="10px" />
      </span>
      <span class="hs-track-row__album"><Skeleton width="50%" height="10px" /></span>
      <span class="hs-track-row__status"></span>
      <span></span>
      <span class="hs-track-row__duration"><Skeleton width="30px" height="10px" /></span>
    </li>
  {/each}
{/snippet}

<PageHeader
  class="search-header"
  title={phone ? undefined : 'Search'}
  onback={phone ? returnFromSearch : undefined}
  onnavigation={phone ? undefined : shell?.openNavigation}
  actions={phone ? pageField : undefined}
/>

{#if failure !== null}
  <StatusPage
    level={2}
    alert
    icon="adwaita-error"
    title="Could Not Load This Page"
    text="The server did not answer. Try again in a moment."
    action={retryAction}
  />
{:else if query.trim() === ''}
  <div class="idle"></div>
{:else if loading}
  <div aria-busy="true">
    <span class="hs-visually-hidden" role="status">Loading...</span>
    <ul class="hs-track-list songs">
      {@render rowPlaceholders(5)}
    </ul>
  </div>
{:else if resultQuery !== null && songs.length + albums.length + artists.length === 0}
  <StatusPage
    level={2}
    icon="adwaita-search"
    title="No Results"
    text={`Nothing matched "${resultQuery}". Check the spelling, or try fewer words.`}
  />
{:else if resultQuery !== null}
  <div class="hs-top-result-row search-top">
    <div class="top-result">
      <SectionHeader title="Top Result" level={2} />
      {#if topResult !== null}
        <TopResultCard
          name={topResult.name}
          kind={topResult.kind}
          artist={topResult.artist}
          href={topResult.href}
          art={topResult.art}
          icon={topResult.icon}
          onplay={topResult.play}
        />
      {/if}
    </div>

    {#if songs.length > 0}
      <div class="top-songs">
        <SectionHeader title="Songs" level={2} />
        <ul class="hs-track-list songs">
          {#each songs as song (song.id)}
            <SongRow {song} {play} />
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  {#if (albums.length > 0 && albumList !== null) || (artists.length > 0 && artistList !== null)}
    <div class="shelves">
      {#if albums.length > 0 && albumList !== null}
        <Shelf title="Albums" href={albumList} flush>
          {#each albums as album (album.id)}
            <AlbumCard {album} />
          {/each}
        </Shelf>
      {/if}
      {#if artists.length > 0 && artistList !== null}
        <Shelf title="Artists" href={artistList} flush>
          {#each artists as artist (artist.id)}
            <ArtistCard {artist} />
          {/each}
        </Shelf>
      {/if}
    </div>
  {/if}
{/if}

<style>
  /* Layout glue only: the shell holds the page off the window edge, so the
     header aligns to that margin and the bodies add their own spacing. */
  :global(.search-header) {
    padding-inline: 0;
  }

  /* On phones the page field fills the header after the back button (l14). */
  :global(.search-header .hs-page-actions) {
    flex: 1;
    min-width: 0;
  }

  /* The idle page keeps the content column's minimum without inventing copy. */
  .idle {
    flex: 1;
  }

  /* p18: the package's row keeps the Top Result's column and the 1000 px
     stacking; the page owns the margins, so its own inline padding goes. */
  :global(.hs-top-result-row.search-top) {
    padding: 0;
    align-items: start;
    gap: var(--hs-space-6);
  }

  .top-result,
  .top-songs {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
    min-width: 0;
  }

  /* The song list fills its grid at the page margin, as the library lists do:
     the rows' own lead inset is pulled out so the art sits on the content
     line and the hover tile reaches into the gutter. */
  .songs {
    margin: 0 0 0 calc(-1 * var(--hs-track-row-inset));
    padding: 0;
  }

  .shelves {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-6);
    padding: var(--hs-space-6) 0 var(--hs-space-7);
  }

  /* The shelves sit at the page margin: the package's Home header padding
     belongs to a page without the shell's own margins (l13, k33). */
  .shelves :global(.hs-home-section .hs-section-header) {
    padding: 0 0 var(--hs-space-3);
  }

  @media (max-width: 720px) {
    .shelves {
      padding-bottom: var(--hs-space-6);
    }

    .songs {
      padding-bottom: 0;
    }
  }
</style>
