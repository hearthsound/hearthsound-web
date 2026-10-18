<!--
  Add one track to a playlist.

  The playlists are read when the menu is opened, because a track is usually
  added to one that was created since the list was last read. Adding is an
  `updatePlaylist` with the track as `songIdToAdd`, which is also what makes
  the track permanent in an owned playlist.
-->
<script lang="ts">
  import { toasts } from '#lib/stores/toasts.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { Playlist } from '#lib/subsonic/types';

  /** Props of an add-to-playlist menu. */
  interface Props {
    /** The client id of the track to add. */
    songId: string;
  }

  let { songId }: Props = $props();

  let open = $state(false);
  let loaded = $state(false);
  let playlists = $state<Playlist[]>([]);
  let failure = $state<string | null>(null);

  /** Opens the menu, reading the playlists the first time. */
  async function toggle(): Promise<void> {
    open = !open;
    if (!open || loaded) {
      return;
    }
    failure = null;
    try {
      playlists = await libraryApi.playlists();
      loaded = true;
    } catch (error) {
      failure = error instanceof Error ? error.message : 'The playlists could not be read.';
    }
  }

  /**
   * Adds the track to a playlist.
   *
   * @param playlist The playlist to add it to.
   */
  async function add(playlist: Playlist): Promise<void> {
    try {
      await libraryApi.updatePlaylist(playlist.id, { add: [songId] });
      toasts.push(`Added to ${playlist.name}.`);
      open = false;
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

<span class="add">
  <button class="add-toggle" type="button" aria-expanded={open} onclick={toggle}>
    Add to playlist
  </button>

  {#if open}
    <div class="add-menu">
      {#if failure !== null}
        <p class="add-failure" role="alert">{failure}</p>
      {:else if playlists.length === 0}
        <p class="add-empty">No playlist yet.</p>
      {:else}
        <ul class="add-list">
          {#each playlists as playlist (playlist.id)}
            <li>
              <button type="button" onclick={() => add(playlist)}>{playlist.name}</button>
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  {/if}
</span>

<style>
  .add {
    position: relative;
    display: inline-block;
  }

  .add-toggle {
    padding: 0 var(--space-2);
    color: var(--color-fg-muted);
    font: inherit;
    font-size: 0.875rem;
    background: none;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .add-menu {
    position: absolute;
    right: 0;
    z-index: 5;
    margin-top: var(--space-1);
    min-width: 12rem;
    padding: var(--space-2);
    background: var(--color-bg-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .add-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .add-list button {
    width: 100%;
    padding: var(--space-1);
    color: var(--color-fg);
    font: inherit;
    text-align: left;
    background: none;
    border: none;
    cursor: pointer;
  }

  .add-list button:hover {
    color: var(--color-accent);
  }

  .add-empty,
  .add-failure {
    margin: 0;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .add-failure {
    color: var(--color-danger);
  }
</style>
