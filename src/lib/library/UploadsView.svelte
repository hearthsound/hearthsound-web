<!--
  The Uploads library view (p13, E9).

  The only upload surface: the k31 drop panel (and the picker inside it), the
  rows of files in flight with their progress, and the uploaded songs below
  them as k12 rows in the no-album context, paged as the reader scrolls (k34).
  A file sent while the view is open joins the list once the server stored it.
  An account that may not upload never reaches the page; the route answers as
  the p27 Not Found instead (o06).
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { SvelteMap } from 'svelte/reactivity';

  import SongRow from '#lib/components/SongRow.svelte';
  import { formatBytes } from '#lib/format';
  import { KIND_TITLES, LIBRARY_KIND_INFO } from '#lib/library/kinds';
  import { firstPagePlaceholders, nextPagePlaceholders } from '#lib/library/placeholders';
  import { loadCollection } from '#lib/library/queue-source';
  import LoadFailure from '#lib/library/LoadFailure.svelte';
  import TrackRowPlaceholders from '#lib/library/TrackRowPlaceholders.svelte';
  import { uploads } from '#lib/library/upload.svelte';
  import { sendFiles } from '#lib/library/upload-send';
  import { UPLOADS_PAGE_SIZE, listUploads } from '#lib/library/uploads';
  import type { UploadedTrack } from '#lib/library/uploads';
  import { PagedList } from '#lib/paging.svelte';
  import { player } from '#lib/player/player.svelte';
  import type { PageLoader } from '#lib/paging.svelte';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { events } from '#lib/stores/events.svelte';
  import { libraryCounts } from '#lib/stores/library-counts.svelte';
  import { session } from '#lib/stores/session.svelte';
  import type { Child } from '#lib/subsonic/types';
  import DropZone from '#lib/ui/DropZone.svelte';
  import EndlessLoader from '#lib/ui/EndlessLoader.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import UploadItem from '#lib/ui/UploadItem.svelte';

  const shell = getShellNavigation();

  const title = KIND_TITLES.uploads;
  const queueSource = LIBRARY_KIND_INFO.uploads.queueSource ?? 'uploads';

  /** The uploaded tracks of the view, paged by cursor. */
  const uploadedTracks = new PagedList<UploadedTrack, string>((track) => track.trackId);

  /** The size of each file this visit sent, by its queue identity. */
  const fileSizes = new SvelteMap<number, string>();

  /** Whether the drop panel shows its armed state (k31-r1). */
  let dragging = $state(false);

  /** The library's counts, which size the placeholders. */
  const counts = $derived(libraryCounts.counts);

  onMount(() => {
    uploadedTracks.start(uploadPage());
    const offChanged = events.on('library.changed', () => {
      uploadedTracks.start(uploadPage());
    });
    const offUpdated = events.on('upload.updated', (event) => {
      uploads.processing(event.data.uploadId);
    });
    return () => {
      offChanged();
      offUpdated();
    };
  });

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
   * Sends the files the picker or the drop answered with.
   *
   * @param files The files to send.
   */
  function send(files: FileList): void {
    sendFiles(
      files,
      session.csrfToken,
      uploads,
      (item, file) => fileSizes.set(item.id, formatBytes(file.size)),
      (entry) => {
        if (entry.state === 'completed') {
          uploadedTracks.start(uploadPage());
        }
      }
    );
  }

  /** Marks the drop panel while a drag crosses the page (k31-r1). */
  function pageDragOver(): void {
    dragging = true;
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

  /**
   * Plays one of the uploaded tracks, with every upload as the queue.
   *
   * @param track The uploaded track to play.
   */
  async function playUpload(track: UploadedTrack): Promise<void> {
    const collection = await loadCollection(queueSource, track.trackId);
    if (collection === null || collection.items.length === 0) {
      return;
    }
    player.play(collection.items, collection.startIndex);
  }

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
</script>

<svelte:head>
  <title>{title} - Hearthsound</title>
</svelte:head>

<svelte:window
  ondragover={pageDragOver}
  ondragleave={pageDragLeave}
  ondrop={pageDrop}
  ondragend={pageDrop}
/>

<PageHeader {title} class="library-header" onnavigation={shell?.openNavigation} />

{#if uploadedTracks.failure !== null}
  <LoadFailure retry={() => void uploadedTracks.loadMore()} />
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
        <SongRow {song} context="no-album" play={() => void playUpload(track)} />
      {/each}
      {#if uploadedTracks.loading}
        <TrackRowPlaceholders
          count={uploadedTracks.items.length === 0
            ? firstPagePlaceholders(counts?.uploads ?? null, UPLOADS_PAGE_SIZE)
            : nextPagePlaceholders(
                counts?.uploads ?? null,
                uploadedTracks.items.length,
                UPLOADS_PAGE_SIZE
              )}
        />
      {/if}
    </ul>
  </EndlessLoader>
{/if}

<style>
  /* A list fills its own grid at the page margin: the row keeps its own 6 px
     lead inset so its hover tile can start left of the art; pulling the list
     out by that inset puts the art on the content line, under the page title,
     and lets the tile extend into the gutter. */
  .uploads {
    margin: 0 0 0 calc(-1 * var(--hs-track-row-inset));
    padding: 0 0 var(--hs-space-6);
  }

  .upload-panel {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    padding: var(--hs-space-3) 0 var(--hs-space-6);
  }

  @media (max-width: 720px) {
    .uploads {
      padding: 0 0 var(--hs-space-5);
    }
  }
</style>
