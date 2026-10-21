<!--
  A playlist.

  The page shows the playlist's name and its tracks. The owner may rename it,
  remove a track and delete it; every write is followed by a fresh read, so the
  track list always shows what the server stored. Playlists carry no lifetime
  indication: the web client never shows or changes one (p12, k15, p17-life). A lost event stream is not a problem
  here: `playlist.changed` reads the playlist again.
-->
<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { page } from '$app/state';

  import SongRow from '#lib/components/SongRow.svelte';
  import { navigate } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { queueItemOf } from '#lib/player/tracks';
  import { availability } from '#lib/stores/availability.svelte';
  import { events } from '#lib/stores/events.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { Child, PlaylistWithEntries } from '#lib/subsonic/types';

  const id = $derived(page.params.id ?? '');

  let playlist = $state<PlaylistWithEntries | null>(null);
  let failure = $state<string | null>(null);
  let loading = $state(true);
  let busy = $state(false);
  let renaming = $state(false);
  let draftName = $state('');

  let generation = 0;

  $effect(() => {
    const current = id;
    const mine = ++generation;
    untrack(() => void load(current, mine));
  });

  onMount(() =>
    events.on('playlist.changed', (event) => {
      if (event.data.playlistId === id) {
        void load(id, ++generation);
      }
    })
  );

  /**
   * Reads the playlist and remembers the availability of its tracks.
   *
   * @param current The playlist's client id.
   * @param mine The generation of this read.
   */
  async function load(current: string, mine: number): Promise<void> {
    loading = true;
    failure = null;
    try {
      const answer = await libraryApi.playlist(current);
      if (mine !== generation) {
        return;
      }
      playlist = answer;
      availability.remember(answer?.entry ?? []);
    } catch (error) {
      if (mine === generation) {
        failure = error instanceof Error ? error.message : 'The playlist could not be read.';
        playlist = null;
      }
    } finally {
      if (mine === generation) {
        loading = false;
      }
    }
  }

  /**
   * Plays one of the playlist's tracks, with the playlist as the queue.
   *
   * @param song The track to play.
   */
  function play(song: Child): void {
    const entries = playlist?.entry ?? [];
    const index = entries.findIndex((entry) => entry.id === song.id);
    player.play(entries.map(queueItemOf), index < 0 ? 0 : index);
  }

  /**
   * Removes a track from the playlist.
   *
   * The index is what the protocol takes, so it is read out of the track list
   * as it stands right now.
   *
   * @param song The track to remove.
   */
  async function removeTrack(song: Child): Promise<void> {
    const entries = playlist?.entry ?? [];
    const index = entries.findIndex((entry) => entry.id === song.id);
    if (index < 0) {
      return;
    }
    await write(() => libraryApi.updatePlaylist(id, { remove: [index] }), 'remove the track');
  }

  /** Starts renaming the playlist. */
  function beginRename(): void {
    draftName = playlist?.name ?? '';
    renaming = true;
  }

  /** Saves a new name for the playlist. */
  async function saveName(): Promise<void> {
    const name = draftName.trim();
    if (name === '') {
      return;
    }
    await write(() => libraryApi.updatePlaylist(id, { name }), 'rename the playlist');
    renaming = false;
  }

  /** Deletes the playlist and returns to the playlists view. */
  async function removePlaylist(): Promise<void> {
    if (!confirm(`Delete the playlist "${playlist?.name ?? ''}"?`)) {
      return;
    }
    const done = await write(() => libraryApi.deletePlaylist(id), 'delete the playlist');
    if (done) {
      await navigate('/library/playlists');
    }
  }

  /**
   * Runs one write and reads the playlist again when it succeeded.
   *
   * @param call The write to make.
   * @param action The words the failure message uses.
   * @returns `true` when the write succeeded.
   */
  async function write(call: () => Promise<void>, action: string): Promise<boolean> {
    if (busy) {
      return false;
    }
    busy = true;
    try {
      await call();
      await load(id, ++generation);
      return true;
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not ${action}: ${error.message}`
          : `Could not ${action}.`,
        'error'
      );
      return false;
    } finally {
      busy = false;
    }
  }
</script>

<svelte:head>
  <title>{playlist?.name ?? 'Playlist'} - Hearthsound</title>
</svelte:head>

<section>
  {#if failure !== null}
    <p class="playlist-failure" role="alert">{failure}</p>
  {:else if loading && playlist === null}
    <p class="playlist-hint">Loading...</p>
  {:else if playlist === null}
    <p class="playlist-hint">There is no such playlist.</p>
  {:else}
    <header class="playlist-header">
      {#if renaming}
        <form
          class="playlist-rename"
          onsubmit={(event) => {
            event.preventDefault();
            void saveName();
          }}
        >
          <input bind:value={draftName} aria-label="Playlist name" disabled={busy} />
          <button type="submit" disabled={busy}>Save</button>
          <button type="button" disabled={busy} onclick={() => (renaming = false)}>Cancel</button>
        </form>
      {:else}
        <h1>{playlist.name}</h1>
      {/if}

      <p class="playlist-meta">
        {playlist.songCount ?? 0}
        {(playlist.songCount ?? 0) === 1 ? 'song' : 'songs'}
        {#if playlist.owner !== undefined}
          by {playlist.owner}{/if}
      </p>

      <div class="playlist-actions">
        <button type="button" disabled={busy} onclick={beginRename}>Rename</button>
        <button type="button" disabled={busy} onclick={removePlaylist}>Delete</button>
      </div>
    </header>

    {#if (playlist.entry ?? []).length === 0}
      <p class="playlist-hint">The playlist is empty.</p>
    {:else}
      <ul class="playlist-songs">
        {#each playlist.entry ?? [] as song (song.id)}
          <SongRow {song} {play} remove={removeTrack} />
        {/each}
      </ul>
    {/if}
  {/if}
</section>

<style>
  .playlist-header {
    margin-bottom: var(--space-4);
  }

  .playlist-header h1 {
    margin: 0;
  }

  .playlist-meta,
  .playlist-hint,
  .playlist-failure {
    margin: var(--space-1) 0 0;
    color: var(--color-fg-muted);
  }

  .playlist-failure {
    color: var(--color-danger);
  }

  .playlist-actions,
  .playlist-rename {
    display: flex;
    gap: var(--space-2);
    align-items: center;
    margin-top: var(--space-2);
  }

  .playlist-actions button,
  .playlist-rename button {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .playlist-actions button:disabled,
  .playlist-rename button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .playlist-rename input {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .playlist-songs {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }
</style>
