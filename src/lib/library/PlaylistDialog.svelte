<!--
  The New Playlist dialog (p12 A, k19, k32).

  A permanent playlist is created from a name alone: the Temporary option is
  gone, so the dialog has one field. The server takes at most 255 bytes of name
  and refuses an empty one; the field counts the same way, so the rule is named
  in the field itself and Create is disabled while the name cannot be sent.

  The dialog reports its own failures inline, because a toast would be painted
  under the scrim. It stays open when the server refused the write, so the name
  is not lost. Escape, the scrim and Cancel close it; there is no close button.
-->
<script lang="ts">
  import { MAX_PLAYLIST_NAME, libraryApi, playlistNameProblem } from '#lib/subsonic/library';
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
  /** What the server refused the last write with. */
  let failure = $state<string | null>(null);
  /** The name that write was refused for; a changed name drops the refusal. */
  let refusedName = $state('');
  /** Whether the name was left or a submit was refused; before that it is not judged. */
  let named = $state(false);

  /** What is wrong with the typed name, or `null` when the server would take it. */
  const problem = $derived(playlistNameProblem(name));
  /** The server's refusal, while the field still holds the name it refused. */
  const refusal = $derived(failure !== null && name === refusedName ? failure : null);
  /** The field's one error: the refusal first, then the broken rule. */
  const error = $derived(refusal ?? (named ? problem : null));

  /**
   * Creates the playlist.
   *
   * @param event The submit event.
   */
  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    named = true;
    if (busy || problem !== null) {
      return;
    }
    busy = true;
    failure = null;
    try {
      const playlist = await libraryApi.createPlaylist(name.trim());
      if (playlist === null) {
        refusedName = name;
        failure = 'The playlist could not be created.';
        return;
      }
      created(playlist);
    } catch (error) {
      refusedName = name;
      failure =
        error instanceof Error && error.message !== ''
          ? `Could not create the playlist: ${error.message}`
          : 'Could not create the playlist.';
    } finally {
      busy = false;
    }
  }
</script>

<Dialog title="New Playlist" onclose={close}>
  <form id={formId} class="hs-form" novalidate onsubmit={submit}>
    <FormField label="Name" for={nameId} error={error ?? undefined}>
      <TextField
        id={nameId}
        bind:value={name}
        disabled={busy}
        invalid={error !== null}
        maxlength={MAX_PLAYLIST_NAME}
        onblur={() => (named = true)}
        required
      />
    </FormField>
  </form>

  {#snippet footer()}
    <Button disabled={busy} onclick={close}>Cancel</Button>
    <Button
      variant="suggested"
      type="submit"
      form={formId}
      {busy}
      disabled={busy || problem !== null}
    >
      Create
    </Button>
  {/snippet}
</Dialog>
