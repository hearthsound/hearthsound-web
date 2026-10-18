<!--
  The new-playlist dialog.

  A client creates a permanent playlist; the checkbox asks for a temporary one,
  which is a second call once the playlist exists. The dialog stays open when
  the server refused the write, so the name is not lost.
-->
<script lang="ts">
  import { toasts } from '#lib/stores/toasts.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { Playlist } from '#lib/subsonic/types';

  /** Props of the new-playlist dialog. */
  interface Props {
    /**
     * Called with the playlist that was created.
     *
     * @param playlist The new playlist.
     */
    created: (playlist: Playlist) => void;
    /** Called when the dialog was dismissed. */
    close: () => void;
  }

  let { created, close }: Props = $props();

  let name = $state('');
  let temporary = $state(false);
  let busy = $state(false);

  /**
   * Creates the playlist and, for a temporary one, converts it.
   *
   * @param event The submit event.
   */
  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (busy) {
      return;
    }
    busy = true;
    try {
      const playlist = await libraryApi.createPlaylist(name.trim());
      if (playlist === null) {
        toasts.push('The playlist could not be created.', 'error');
        return;
      }
      if (temporary) {
        await libraryApi.setPlaylistLifetime(playlist.id, true);
      }
      created(playlist);
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not create the playlist: ${error.message}`
          : 'Could not create the playlist.',
        'error'
      );
    } finally {
      busy = false;
    }
  }
</script>

<form class="dialog" onsubmit={submit}>
  <h2>New playlist</h2>

  <label class="dialog-field">
    <span>Name</span>
    <input bind:value={name} required disabled={busy} />
  </label>

  <label class="dialog-check">
    <input type="checkbox" bind:checked={temporary} disabled={busy} />
    <span>Temporary</span>
  </label>

  <div class="dialog-actions">
    <button type="submit" disabled={busy || name.trim() === ''}>Create</button>
    <button type="button" disabled={busy} onclick={close}>Cancel</button>
  </div>
</form>

<style>
  .dialog {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: flex-start;
    max-width: 20rem;
    padding: var(--space-4);
    background: var(--color-bg-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .dialog h2 {
    margin: 0;
    font-size: 1rem;
  }

  .dialog-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    width: 100%;
  }

  .dialog-field input {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .dialog-check {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .dialog-actions {
    display: flex;
    gap: var(--space-2);
  }

  .dialog-actions button {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .dialog-actions button:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
