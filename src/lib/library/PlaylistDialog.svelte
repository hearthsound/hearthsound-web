<!--
  The New Playlist dialog (p12 A, k19, k32).

  A permanent playlist is created from a name alone: the Temporary option is
  gone, so the dialog has one field. The dialog stays open when the server
  refused the write, so the name is not lost. Escape, the scrim and Cancel
  close it; there is no close button.
-->
<script lang="ts">
  import { toasts } from '#lib/stores/toasts.svelte';
  import { libraryApi } from '#lib/subsonic/library';
  import type { Playlist } from '#lib/subsonic/types';
  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import TextField from '#lib/ui/TextField.svelte';

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

  const formId = $props.id();
  const nameId = `${formId}-name`;

  let name = $state('');
  let busy = $state(false);

  /**
   * Creates the playlist.
   *
   * @param event The submit event.
   */
  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const trimmed = name.trim();
    if (busy || trimmed === '') {
      return;
    }
    busy = true;
    try {
      const playlist = await libraryApi.createPlaylist(trimmed);
      if (playlist === null) {
        toasts.push('The playlist could not be created.', 'error');
        return;
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

<Dialog title="New Playlist" onclose={close}>
  <form id={formId} class="hs-form" novalidate onsubmit={submit}>
    <FormField label="Name" for={nameId}>
      <TextField id={nameId} bind:value={name} disabled={busy} required />
    </FormField>
  </form>

  {#snippet footer()}
    <Button disabled={busy} onclick={close}>Cancel</Button>
    <Button
      variant="suggested"
      type="submit"
      form={formId}
      {busy}
      disabled={busy || name.trim() === ''}
    >
      Create
    </Button>
  {/snippet}
</Dialog>
