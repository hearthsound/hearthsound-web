<!--
  Add one track to a playlist (k18 A).

  The song menu's "Add to Playlist" item opens a submenu, or replaces the menu
  with the same list on a phone. The playlists are read when the song menu
  opens, because a track is usually added to one that was created since the
  list was last read; until that read answers the list stays empty rather than
  claiming there are none. "New Playlist" is handed to the caller, which opens the
  dialog outside the menu so closing the menu does not take the dialog with it.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import { coverArtUrl } from '#lib/player/stream';
  import { toasts } from '#lib/stores/toasts.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { Playlist } from '#lib/subsonic/types';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import MenuSeparator from '#lib/ui/MenuSeparator.svelte';
  import Mosaic from '#lib/ui/Mosaic.svelte';

  /** Props of an add-to-playlist submenu. */
  interface Props {
    /** The client id of the track to add. */
    songId: string;
    /** Opens the New Playlist dialog; the caller owns it. */
    onnew: () => void;
  }

  let { songId, onnew }: Props = $props();

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
   * Adds the track to a playlist.
   *
   * @param playlist The playlist to add it to.
   */
  async function add(playlist: Playlist): Promise<void> {
    try {
      await libraryApi.updatePlaylist(playlist.id, { add: [songId] });
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
        <MenuItem label={playlist.name} onselect={() => void add(playlist)}>
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
