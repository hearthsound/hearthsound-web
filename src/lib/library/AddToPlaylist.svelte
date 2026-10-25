<!--
  Add a track or a whole album to a playlist (k18 A).

  The song or album menu's "Add to Playlist" item opens a submenu, or replaces
  the menu with the same list on a phone. The playlists are read when the menu
  opens, because a track is usually added to one that was created since the
  list was last read; until that read answers the list stays empty rather than
  claiming there are none. A track is added through the Subsonic surface; a
  whole album is appended in one native request. "New Playlist" is handed to
  the caller, which opens the dialog outside the menu so closing the menu does
  not take the dialog with it; the caller adds the track or album afterwards.

  Adding to a playlist a listening service generates asks first: the add is the
  playlist's first edit, which makes it the reader's own and stops it
  refreshing. That confirmation is mounted on the document rather than drawn
  here, for the reason the New Playlist dialog is the caller's: choosing an item
  closes the menu and takes everything inside it, and the menu's own panel
  paints above a dialog that lived in it.
-->
<script lang="ts">
  import { mount, onMount, unmount } from 'svelte';

  import GeneratedPlaylistDialog from '#lib/library/GeneratedPlaylistDialog.svelte';
  import { addPlaylistSource } from '#lib/library/playlist-write';
  import type { PlaylistSource } from '#lib/library/playlist-write';
  import { coverArtUrl } from '#lib/player/stream';
  import { toasts } from '#lib/stores/toasts.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { Playlist } from '#lib/subsonic/types';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';
  import Mosaic from '#lib/ui/Mosaic.svelte';

  /** Props of an add-to-playlist submenu. */
  interface Props {
    /** The client id of the track to add; absent when a whole collection is. */
    songId?: string;
    /** The whole collection to append, which takes the place of `songId`. */
    source?: PlaylistSource;
    /** Opens the New Playlist dialog; the caller owns it. */
    onnew: () => void;
  }

  let { songId, source, onnew }: Props = $props();

  /** The caller's playlists; `null` until the read answers. */
  let playlists = $state<Playlist[] | null>(null);
  let failure = $state<string | null>(null);

  onMount(async () => {
    try {
      playlists = await libraryApi.playlists();
    } catch (error) {
      failure = error instanceof Error ? error.message : 'The playlists could not be read.';
    }
  });

  /**
   * Adds the track or the whole collection to a playlist.
   *
   * @param playlist The playlist to add it to.
   */
  async function choose(playlist: Playlist): Promise<void> {
    const service = playlist.hearthsound?.generatedBy;
    if (service !== undefined && !(await confirmDetach(service))) {
      return;
    }
    await add(playlist);
  }

  /**
   * Asks whether the reader accepts that this playlist stops being generated.
   *
   * The question is not drawn by this component, which the menu unmounts as
   * soon as an item is chosen; it is mounted on the document, over the page,
   * and removed on the answer. Going back in the history answers no, so the
   * question never outlives the page it was asked on.
   *
   * @param service The display name of the service that generates the playlist.
   * @returns `true` when the reader confirms the add.
   */
  function confirmDetach(service: string): Promise<boolean> {
    return new Promise((resolve) => {
      let answered = false;
      let dialog: Record<string, unknown> | null = null;

      /**
       * Removes the question and reports the reader's answer.
       *
       * @param confirmed Whether the reader accepted the add.
       */
      function finish(confirmed: boolean): void {
        if (answered) {
          return;
        }
        answered = true;
        window.removeEventListener('popstate', leave);
        if (dialog !== null) {
          unmount(dialog);
          dialog = null;
        }
        resolve(confirmed);
      }

      /** Answers no because the page behind the question is being left. */
      function leave(): void {
        finish(false);
      }

      dialog = mount(GeneratedPlaylistDialog, {
        target: document.body,
        props: {
          service,
          oncancel: () => finish(false),
          onconfirm: () => finish(true)
        }
      });
      window.addEventListener('popstate', leave);
    });
  }

  /**
   * Adds the track or the whole collection to a playlist.
   *
   * @param playlist The playlist to add it to.
   */
  async function add(playlist: Playlist): Promise<void> {
    try {
      if (source !== undefined) {
        await addPlaylistSource(playlist.id, source);
      } else if (songId !== undefined) {
        await libraryApi.updatePlaylist(playlist.id, { add: [songId] });
      }
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
</script>

<MenuItem label="Add to Playlist" icon="adwaita-playlist" submenuLabel="Add to Playlist">
  {#snippet submenu()}
    <MenuItem label="New Playlist" icon="adwaita-add" onselect={onnew} />
    <MenuSeparator />
    {#if failure !== null}
      <p class="hs-menu__empty" role="alert">{failure}</p>
    {:else if playlists === null}
      <!-- Still reading: no line until the answer says whether there are any. -->
    {:else if playlists.length === 0}
      <p class="hs-menu__empty">No playlists yet</p>
    {:else}
      {#each playlists as playlist (playlist.id)}
        <MenuItem label={playlist.name} onselect={() => void choose(playlist)}>
          {#snippet leading()}
            <span class="hs-menu__cover">
              <Mosaic
                covers={playlist.coverArt === undefined ? [] : [coverArtUrl(playlist.coverArt, 56)]}
              />
            </span>
          {/snippet}
        </MenuItem>
      {/each}
    {/if}
  {/snippet}
</MenuItem>

<style>
  /* Layout glue only: the muted line keeps the menu's own text spacing. */
  .hs-menu__empty {
    margin: 0;
  }
</style>
