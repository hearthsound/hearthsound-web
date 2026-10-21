<!--
  A library view.

  One component renders the personal library's lists: the songs, the albums,
  the artists, the liked entities, the playlists and the uploads page. Every
  list is the approved design's page: a page header with the one action that
  belongs to it, the p08e empty state under the title, the o03 status page when
  a read fails, and k34 endless loading for the lists the server pages.

  The uploads page is the only upload surface (p13): the drop panel, the rows
  of files in flight and the uploaded songs below them. An account that may not
  upload never reaches it; the route answers as the p27 Not Found instead.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';
  import type { IconName } from '@hearthsound/design/icons';

  import AlbumCard from '#lib/components/AlbumCard.svelte';
  import ArtistCard from '#lib/components/ArtistCard.svelte';
  import SongRow from '#lib/components/SongRow.svelte';
  import { formatBytes } from '#lib/admin/bytes';
  import { KIND_TITLES } from '#lib/library/kinds';
  import type { LibraryKind } from '#lib/library/kinds';
  import { PagedList } from '#lib/library/paging.svelte';
  import type { PageLoader } from '#lib/library/paging.svelte';
  import PlaylistDialog from '#lib/library/PlaylistDialog.svelte';
  import { uploads } from '#lib/library/upload.svelte';
  import { uploadFile } from '#lib/library/uploader';
  import { listUploads } from '#lib/library/uploads';
  import type { UploadedTrack } from '#lib/library/uploads';
  import { canUpload } from '#lib/nav';
  import { navigate } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { coverArtUrl } from '#lib/player/stream';
  import { loadCollection, type QueueSource } from '#lib/library/queue-source';
  import { availability } from '#lib/stores/availability.svelte';
  import { events } from '#lib/stores/events.svelte';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { session } from '#lib/stores/session.svelte';
  import { libraryApi, LIBRARY_PAGE_SIZE, PERSONAL_FOLDER } from '#lib/subsonic/library';
  import type { AlbumID3, ArtistID3, Child, Playlist, Starred2 } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import CardPlaceholders from '#lib/ui/CardPlaceholders.svelte';
  import DropZone from '#lib/ui/DropZone.svelte';
  import EndlessLoader from '#lib/ui/EndlessLoader.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import PlaylistCard from '#lib/ui/PlaylistCard.svelte';
  import SectionHeader from '#lib/ui/SectionHeader.svelte';
  import Shelf from '#lib/ui/Shelf.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import UploadItem from '#lib/ui/UploadItem.svelte';

  /** Props of a library view. */
  interface Props {
    /** The list to show. */
    kind: LibraryKind;
  }

  let { kind }: Props = $props();

  const shell = getShellNavigation();

  /** The tracks of the songs view. */
  const songs = new PagedList<Child>((song) => song.id);

  /** The albums of the albums view. */
  const albums = new PagedList<AlbumID3>((album) => album.id);

  /** The uploaded tracks of the uploads view. */
  const uploadedTracks = new PagedList<UploadedTrack, string>((track) => track.trackId);

  let artists = $state<ArtistID3[]>([]);
  let starred = $state<Starred2>({});
  let playlists = $state<Playlist[]>([]);
  let playlistCovers = $state<Record<string, string[]>>({});
  let loading = $state(true);
  let failure = $state<string | null>(null);
  let creating = $state(false);
  let dragging = $state(false);

  /** The grids that hold placeholders while their list loads. */
  let albumGrid = $state<HTMLDivElement>();
  let artistGrid = $state<HTMLDivElement>();
  let playlistGrid = $state<HTMLDivElement>();
  let likedGrid = $state<HTMLDivElement>();

  let generation = 0;

  /** The playlists' entries, kept from the mosaic read so Play needs no read. */
  const playlistEntries = new SvelteMap<string, Child[]>();

  /** The size of each file this visit sent, by its queue identity. */
  const fileSizes = new SvelteMap<number, string>();

  const title = $derived(KIND_TITLES[kind]);
  const mayUpload = $derived(
    canUpload({
      isAdmin: session.isAdmin,
      systemInfo: session.systemInfo,
      user: session.user
    })
  );
  const showsActions = $derived(
    (kind === 'songs' || kind === 'playlists') &&
      (kind !== 'songs' || songs.failure === null) &&
      (kind !== 'playlists' || failure === null)
  );

  $effect(() => {
    const current = kind;
    const mine = ++generation;
    untrack(() => void load(current, mine));
  });

  onMount(() =>
    events.on('library.changed', () => {
      // A like, an unsave or an upload changes what the lists hold: the liked
      // view shows memberships and the uploads view a listing, so both are
      // read again.
      if (kind === 'liked') {
        void load('liked', ++generation);
      } else if (kind === 'uploads') {
        uploadedTracks.start(uploadPage());
      }
    })
  );

  onMount(() =>
    events.on('playlist.changed', () => {
      if (kind === 'playlists') {
        void load('playlists', ++generation);
      }
    })
  );

  onMount(() =>
    events.on('upload.updated', (event) => {
      uploads.processing(event.data.uploadId);
    })
  );

  /**
   * Opens the playlist that was just created.
   *
   * @param playlist The new playlist.
   */
  async function openPlaylist(playlist: Playlist): Promise<void> {
    creating = false;
    await navigate(`/playlist/${playlist.id}`);
  }

  /**
   * Reads the list a view shows.
   *
   * A read whose answer arrives after the view changed is dropped, so a slow
   * list never overwrites the one the reader asked for.
   *
   * @param current The list to read.
   * @param mine The generation of this read.
   */
  async function load(current: LibraryKind, mine: number): Promise<void> {
    failure = null;
    if (current === 'songs') {
      songs.start(songPage());
      return;
    }
    if (current === 'albums') {
      albums.start(albumPage());
      return;
    }
    if (current === 'uploads') {
      uploadedTracks.start(uploadPage());
      return;
    }
    artists = [];
    starred = {};
    playlists = [];
    playlistCovers = {};
    playlistEntries.clear();
    loading = true;
    try {
      if (current === 'artists') {
        const answer = await libraryApi.artists(PERSONAL_FOLDER);
        if (mine !== generation) {
          return;
        }
        artists = answer;
        availability.remember(answer);
      } else if (current === 'liked') {
        const answer = await libraryApi.starred();
        if (mine !== generation) {
          return;
        }
        starred = answer;
        availability.remember([
          ...(answer.song ?? []),
          ...(answer.album ?? []),
          ...(answer.artist ?? [])
        ]);
      } else {
        const answer = await libraryApi.playlists();
        if (mine !== generation) {
          return;
        }
        playlists = answer;
        const covers = await Promise.all(
          answer.map(async (playlist) => {
            try {
              const full = await libraryApi.playlist(playlist.id);
              const entries = full?.entry ?? [];
              playlistEntries.set(playlist.id, entries);
              const ids = entries
                .map((entry) => entry.coverArt)
                .filter((id): id is string => id !== undefined && id !== '');
              return [playlist.id, ids.slice(0, 4).map((id) => coverArtUrl(id, 300))] as const;
            } catch {
              return [
                playlist.id,
                playlist.coverArt === undefined ? [] : [coverArtUrl(playlist.coverArt, 300)]
              ] as const;
            }
          })
        );
        if (mine !== generation) {
          return;
        }
        playlistCovers = Object.fromEntries(covers);
      }
    } catch (error) {
      if (mine === generation) {
        failure = error instanceof Error ? error.message : 'The list could not be read.';
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  /**
   * Builds the read of one page of tracks.
   *
   * @returns The loader of the track list.
   */
  function songPage(): PageLoader<Child, number> {
    return async (offset) => {
      const start = offset ?? 0;
      const entries = await libraryApi.songs(PERSONAL_FOLDER, start, LIBRARY_PAGE_SIZE);
      availability.remember(entries);
      return {
        items: entries,
        next: entries.length < LIBRARY_PAGE_SIZE ? null : start + entries.length
      };
    };
  }

  /**
   * Builds the read of one page of albums.
   *
   * @returns The loader of the album list.
   */
  function albumPage(): PageLoader<AlbumID3, number> {
    return async (offset) => {
      const start = offset ?? 0;
      const entries = await libraryApi.albums(PERSONAL_FOLDER, start, LIBRARY_PAGE_SIZE);
      availability.remember(entries);
      return {
        items: entries,
        next: entries.length < LIBRARY_PAGE_SIZE ? null : start + entries.length
      };
    };
  }

  /**
   * Builds the read of one page of uploads.
   *
   * @returns The loader of the uploads list.
   */
  function uploadPage(): PageLoader<UploadedTrack, string> {
    return async (cursor) => {
      const page = await listUploads(cursor);
      return { items: page.tracks, next: page.nextCursor };
    };
  }

  /**
   * Retries the read that failed.
   */
  function retry(): void {
    if (kind === 'songs') {
      void songs.loadMore();
    } else if (kind === 'albums') {
      void albums.loadMore();
    } else if (kind === 'uploads') {
      void uploadedTracks.loadMore();
    } else {
      void load(kind, ++generation);
    }
  }

  /**
   * Queues a whole collection and starts at one of its tracks.
   *
   * The collection comes from the server in one call, so a library of thousands
   * of tracks plays in full from the first click rather than only the pages the
   * browser had loaded (queue-api).
   *
   * @param source The collection to queue.
   * @param from The track to start at; absent starts at the head.
   * @param shuffle Whether to switch the player's shuffled order on.
   */
  async function playCollection(
    source: QueueSource,
    from?: string,
    shuffle = false
  ): Promise<void> {
    const collection = await loadCollection(source, from);
    if (collection === null || collection.items.length === 0) {
      return;
    }
    player.play(collection.items, collection.startIndex);
    player.setShuffle(shuffle);
  }

  /** The collection the current view plays in full. */
  const queueSource = $derived<QueueSource | null>(
    kind === 'songs' ? 'songs' : kind === 'liked' ? 'liked' : kind === 'uploads' ? 'uploads' : null
  );

  /**
   * Reads an uploaded track as the row component's track.
   *
   * @param track The uploaded track.
   * @returns The track, in the shape the song row reads.
   */
  function uploadedSong(track: UploadedTrack): Child {
    return {
      id: track.trackId,
      title: track.title,
      artist: track.artist ?? undefined,
      album: track.album ?? undefined,
      albumId: track.albumId ?? undefined,
      duration: track.durationSecs ?? undefined
    };
  }

  /**
   * Plays one of the uploaded tracks, with every upload as the queue.
   *
   * @param track The uploaded track to play.
   */
  function playUpload(track: UploadedTrack): void {
    void playCollection('uploads', track.trackId);
  }

  /**
   * Plays one of the playlist cards.
   *
   * @param playlist The playlist to play.
   */
  async function playPlaylist(playlist: Playlist): Promise<void> {
    try {
      await playCollection(`playlist:${playlist.id}`);
    } catch {
      // A cover read failure must not take the view down; the card simply
      // does not play.
    }
  }

  /**
   * Sends the files the picker or the drop answered with.
   *
   * @param files The files to send.
   */
  function send(files: FileList): void {
    for (const file of files) {
      const [item] = uploads.add([{ name: file.name }]);
      if (item === undefined) {
        continue;
      }
      fileSizes.set(item.id, formatBytes(file.size));
      void begin(item.id, file);
    }
  }

  /**
   * Sends one file and records what the server made of it.
   *
   * @param id The item's identity in the queue.
   * @param file The file to send.
   */
  async function begin(id: number, file: File): Promise<void> {
    uploads.start(id);
    try {
      const outcome = await uploadFile(file, session.csrfToken, (percent) =>
        uploads.progress(id, percent)
      );
      if (outcome.status === 413) {
        uploads.tooLarge(id);
        return;
      }
      if (outcome.status >= 400) {
        uploads.fail(id, `the server answered HTTP ${outcome.status}`);
        return;
      }
      const entry = outcome.entries[0];
      if (entry === undefined) {
        uploads.fail(id, 'the server answered nothing about the file');
        return;
      }
      uploads.finish(id, entry);
      if (entry.state === 'completed' && kind === 'uploads') {
        uploadedTracks.start(uploadPage());
      }
    } catch (error) {
      uploads.fail(
        id,
        error instanceof Error && error.message !== ''
          ? error.message
          : 'the upload did not go through'
      );
    }
  }

  /** Marks the drop panel while a drag crosses the page (k31-r1). */
  function pageDragOver(): void {
    if (kind === 'uploads') {
      dragging = true;
    }
  }

  /**
   * Clears the drop state once the drag leaves the window.
   *
   * @param event The drag event.
   */
  function pageDragLeave(event: DragEvent): void {
    if (event.relatedTarget === null) {
      dragging = false;
    }
  }

  /** Clears the drop state once a drop or a drag ends. */
  function pageDrop(): void {
    dragging = false;
  }
</script>

<svelte:window
  ondragover={pageDragOver}
  ondragleave={pageDragLeave}
  ondrop={pageDrop}
  ondragend={pageDrop}
/>

{#snippet uploadAction()}
  <Button icon="custom-upload" onclick={() => void navigate('/library/uploads')}>
    Upload Songs
  </Button>
{/snippet}

{#snippet retryAction()}
  <Button onclick={retry}>Retry</Button>
{/snippet}

{#snippet loadFailure()}
  <StatusPage
    level={2}
    alert
    icon="adwaita-error"
    title="Could Not Load This Page"
    text="The server did not answer. Try again in a moment."
    action={retryAction}
  />
{/snippet}

{#snippet emptyState(icon: IconName, heading: string, text: string, upload: boolean)}
  <StatusPage
    level={2}
    {icon}
    title={heading}
    {text}
    action={upload && mayUpload ? uploadAction : undefined}
  />
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

{#snippet headerActions()}
  {#if kind === 'songs'}
    <Button
      variant="suggested"
      header
      icon="adwaita-play"
      label="Play"
      disabled={songs.items.length === 0}
      onclick={() => queueSource !== null && void playCollection(queueSource, undefined, false)}
    >
      Play
    </Button>
    <Button
      header
      icon="adwaita-shuffle"
      label="Shuffle"
      disabled={songs.items.length === 0}
      onclick={() => queueSource !== null && void playCollection(queueSource, undefined, true)}
    >
      Shuffle
    </Button>
  {:else if kind === 'playlists'}
    <Button header icon="adwaita-add" label="New Playlist" onclick={() => (creating = true)}>
      New Playlist
    </Button>
  {/if}
{/snippet}

<PageHeader
  {title}
  class="library-header"
  onnavigation={shell?.openNavigation}
  actions={showsActions ? headerActions : undefined}
/>

{#if kind === 'songs'}
  {#if songs.failure !== null}
    {@render loadFailure()}
  {:else if songs.done && songs.items.length === 0}
    {@render emptyState(
      'adwaita-song',
      'No Songs Yet',
      'Songs you like, save, add to a playlist or upload show up here.',
      true
    )}
  {:else}
    <EndlessLoader onmore={() => void songs.loadMore()} busy={songs.loading} done={songs.done}>
      <ul class="hs-track-list songs">
        {#each songs.items as song (song.id)}
          <SongRow
            {song}
            play={() => {
              if (queueSource !== null) {
                void playCollection(queueSource, song.id);
              }
            }}
          />
        {/each}
        {#if songs.loading}
          {@render rowPlaceholders(3)}
        {/if}
      </ul>
    </EndlessLoader>
  {/if}
{:else if kind === 'albums'}
  {#if albums.failure !== null}
    {@render loadFailure()}
  {:else if albums.done && albums.items.length === 0}
    {@render emptyState(
      'adwaita-album',
      'No Albums Yet',
      'Albums with songs in your library show up here.',
      true
    )}
  {:else}
    <EndlessLoader onmore={() => void albums.loadMore()} busy={albums.loading} done={albums.done}>
      <div class="hs-card-grid cards" bind:this={albumGrid}>
        {#each albums.items as album (album.id)}
          <AlbumCard {album} />
        {/each}
        {#if albums.loading}
          <CardPlaceholders items={albums.items.length} grid={albumGrid} />
        {/if}
      </div>
    </EndlessLoader>
  {/if}
{:else if kind === 'artists'}
  {#if failure !== null}
    {@render loadFailure()}
  {:else if loading}
    <div class="loading" aria-busy="true">
      <span class="hs-visually-hidden" role="status">Loading...</span>
      <div class="hs-card-grid cards" bind:this={artistGrid}>
        <CardPlaceholders items={0} grid={artistGrid} artist rows={2} />
      </div>
    </div>
  {:else if artists.length === 0}
    {@render emptyState(
      'adwaita-artist',
      'No Artists Yet',
      'Artists with songs in your library show up here.',
      true
    )}
  {:else}
    <div class="hs-card-grid cards">
      {#each artists as artist (artist.id)}
        <ArtistCard {artist} />
      {/each}
    </div>
  {/if}
{:else if kind === 'liked'}
  {#if failure !== null}
    {@render loadFailure()}
  {:else if loading}
    <div class="loading" aria-busy="true">
      <span class="hs-visually-hidden" role="status">Loading...</span>
      <div class="hs-card-grid cards" bind:this={likedGrid}>
        <CardPlaceholders items={0} grid={likedGrid} />
      </div>
      <ul class="hs-track-list liked-songs">
        {@render rowPlaceholders(3)}
      </ul>
    </div>
  {:else if (starred.song ?? []).length === 0 && (starred.album ?? []).length === 0 && (starred.artist ?? []).length === 0}
    {@render emptyState(
      'adwaita-like',
      'Nothing Liked Yet',
      'Use the heart on a song, album or artist to keep it here.',
      false
    )}
  {:else}
    <div class="liked">
      {#if (starred.album ?? []).length > 0 || (starred.artist ?? []).length > 0}
        <div class="hs-home">
          {#if (starred.album ?? []).length > 0}
            <Shelf title="Albums" href="/liked/albums" flush>
              {#each starred.album ?? [] as album (album.id)}
                <AlbumCard {album} />
              {/each}
            </Shelf>
          {/if}
          {#if (starred.artist ?? []).length > 0}
            <Shelf title="Artists" href="/liked/artists" flush>
              {#each starred.artist ?? [] as artist (artist.id)}
                <ArtistCard {artist} />
              {/each}
            </Shelf>
          {/if}
        </div>
      {/if}
      {#if (starred.song ?? []).length > 0}
        <SectionHeader title="Songs" level={2} class="liked-songs-heading" />
        <ul class="hs-track-list liked-songs">
          {#each starred.song ?? [] as song (song.id)}
            <SongRow {song} play={() => void playCollection('liked', song.id)} />
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
{:else if kind === 'playlists'}
  {#if failure !== null}
    {@render loadFailure()}
  {:else if loading}
    <div class="loading" aria-busy="true">
      <span class="hs-visually-hidden" role="status">Loading...</span>
      <div class="hs-card-grid cards" bind:this={playlistGrid}>
        <CardPlaceholders items={0} grid={playlistGrid} rows={2} />
      </div>
    </div>
  {:else if playlists.length === 0}
    {@render emptyState(
      'adwaita-playlist',
      'No Playlists Yet',
      'Playlists you create show up here.',
      false
    )}
  {:else}
    <div class="hs-card-grid cards">
      {#each playlists as playlist (playlist.id)}
        <PlaylistCard
          name={playlist.name}
          songs={playlist.songCount ?? 0}
          href={`/playlist/${playlist.id}`}
          covers={playlistCovers[playlist.id] ?? []}
          onplay={() => void playPlaylist(playlist)}
        />
      {/each}
    </div>
  {/if}
{:else if kind === 'uploads'}
  {#if uploadedTracks.failure !== null}
    {@render loadFailure()}
  {:else}
    <div class="upload-panel">
      <DropZone onfiles={send} {dragging} />
      {#if uploads.items.length > 0}
        <div class="hs-settings-group">
          {#each uploads.items as item (item.id)}
            <UploadItem
              name={item.fileName}
              size={fileSizes.get(item.id) ?? ''}
              state={item.state}
              progress={Math.floor(item.percent)}
              reason={item.failure === null ? undefined : item.failure.replace(/^Failed: /, '')}
            />
          {/each}
        </div>
      {/if}
    </div>
    <EndlessLoader
      onmore={() => void uploadedTracks.loadMore()}
      busy={uploadedTracks.loading}
      done={uploadedTracks.done}
    >
      <ul class="hs-track-list hs-track-list--no-album uploads">
        {#each uploadedTracks.items as track (track.trackId)}
          {@const song = uploadedSong(track)}
          <SongRow {song} context="no-album" play={() => playUpload(track)} />
        {/each}
        {#if uploadedTracks.loading}
          {@render rowPlaceholders(3)}
        {/if}
      </ul>
    </EndlessLoader>
  {/if}
{/if}

{#if creating}
  <PlaylistDialog created={openPlaylist} close={() => (creating = false)} />
{/if}

<style>
  /* Layout glue only: the shell already holds the page off the window edge, so
     the header aligns to that margin and the bodies add their own spacing. */
  :global(.library-header) {
    padding-inline: 0;
  }

  /* A list fills its own grid at the page margin: the browser's list margin
     and indent would inset its rows from the header and from each other. The
     row keeps its own 6 px lead inset so its hover tile can start left of the
     art; pulling the list out by that inset puts the art on the content line,
     under the page title, and lets the tile extend into the gutter. */
  .songs,
  .uploads,
  .liked-songs {
    margin: 0 0 0 calc(-1 * var(--hs-track-row-inset));
    padding: 0 0 var(--hs-space-6);
  }

  .cards {
    padding: var(--hs-space-3) 0 var(--hs-space-7);
  }

  /* The loading state lays its placeholders in the loaded state's own grid and
     padding, so the title's gap and the scroll position do not move when the
     read finishes. */
  .loading {
    display: contents;
  }

  .liked {
    display: flex;
    flex-direction: column;
  }

  /* The Liked shelves sit at the page margin rather than the Home shelf's
     own 32 px inset, because the shell already pads the content column. The
     package's shelf keeps 32 px of scrollport padding for the Home header it
     normally sits under; here the scrollport keeps exactly the 8 px the cards
     draw their hover tile in, pulled back out of the column, so the first
     card's art starts on the content line under the section title. */
  /* The Songs heading takes the shelf header's own spacing, so it sits the
     same distance from the shelf above and from its list below. */
  .liked :global(.liked-songs-heading) {
    padding: var(--hs-space-3) 0 var(--hs-space-3);
  }

  .upload-panel {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    padding: var(--hs-space-3) 0 var(--hs-space-6);
  }

  @media (max-width: 720px) {
    .cards {
      padding-bottom: var(--hs-space-6);
    }

    .songs,
    .uploads,
    .liked-songs {
      padding: 0 0 var(--hs-space-5);
    }
  }
</style>
