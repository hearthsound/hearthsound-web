<!--
  The music folder dialog: the path of a new folder, its display name, whether
  it is watched, and whether it belongs to an account or is generic.

  A new folder belongs to the administrator who adds it unless the radio is
  switched to generic, and a generic folder has no owner to choose.
-->
<script lang="ts">
  import { untrack } from 'svelte';

  import { nativeClient } from '#lib/api/native';

  import Dialog from './Dialog.svelte';
  import { folderPatchBody, newFolderBody } from './folders';
  import type { FolderView } from './folders';
  import { problemMessage } from './problem';
  import type { AdminUser } from './users';

  /** Props of the dialog. */
  interface Props {
    /** The folder to edit, or `null` to add one. */
    folder: FolderView | null;
    /** The accounts a folder may belong to. */
    users: AdminUser[];
    /** The account a new folder belongs to unless the dialog is changed. */
    defaultOwner: string;
    /** Closes the dialog. */
    onclose: () => void;
    /** Receives the folder the server answered with. */
    onsaved: (folder: FolderView) => void;
  }

  let { folder, users, defaultOwner, onclose, onsaved }: Props = $props();

  const editing = untrack(() => folder !== null);
  let path = $state(untrack(() => folder?.path ?? ''));
  let name = $state(untrack(() => folder?.name ?? ''));
  let watch = $state(untrack(() => folder?.watch ?? true));
  let generic = $state(untrack(() => folder?.generic ?? false));
  let owner = $state(untrack(() => folder?.owner ?? defaultOwner));
  let failure = $state<string | null>(null);
  let busy = $state(false);

  /**
   * Saves the folder the fields describe.
   *
   * @param event The form submission.
   */
  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    const association = { generic, owner };
    const answer =
      folder === null
        ? await nativeClient.POST('/api/v1/admin/folders', {
            body: newFolderBody(path, name, watch, association)
          })
        : await nativeClient.PATCH('/api/v1/admin/folders/{id}', {
            params: { path: { id: folder.id } },
            body: folderPatchBody(name, watch, association)
          });
    busy = false;
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not save the folder.');
      return;
    }
    onsaved(answer.data);
  }
</script>

<Dialog title={editing ? 'Edit folder' : 'Add folder'} {onclose}>
  <form class="form" onsubmit={save}>
    {#if editing}
      <p class="path">{folder?.path}</p>
    {:else}
      <label class="field">
        <span class="field-label">Path</span>
        <input class="input" bind:value={path} required />
        <span class="field-hint">The absolute path of the folder on the server.</span>
      </label>
    {/if}

    <label class="field">
      <span class="field-label">Name</span>
      <input class="input" bind:value={name} />
      <span class="field-hint">The name shown in this view; the directory name when empty.</span>
    </label>

    <fieldset class="association">
      <legend class="field-label">Belongs to</legend>
      <label class="choice">
        <input
          type="radio"
          name="association"
          checked={!generic}
          onchange={() => (generic = false)}
        />
        <span>An account</span>
        <select class="input" bind:value={owner} disabled={generic}>
          {#each users as user (user.id)}
            <option value={user.id}>{user.username}</option>
          {/each}
        </select>
      </label>
      <label class="choice">
        <input
          type="radio"
          name="association"
          checked={generic}
          onchange={() => (generic = true)}
        />
        <span>Generic</span>
      </label>
    </fieldset>

    <label class="checkbox">
      <input type="checkbox" bind:checked={watch} />
      <span>Watch for changes</span>
    </label>

    {#if failure !== null}
      <p class="failure" role="alert">{failure}</p>
    {/if}

    <div class="commands">
      <button class="primary" type="submit" disabled={busy}>
        {editing ? 'Save changes' : 'Add folder'}
      </button>
      <button type="button" onclick={onclose}>Cancel</button>
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-label {
    font-weight: 600;
  }

  .field-hint {
    margin: 0;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .path {
    margin: 0;
    font-family: var(--font-mono);
  }

  .input {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .input:disabled {
    color: var(--color-fg-muted);
    background: var(--color-bg-sunken);
  }

  .association {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .choice {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .checkbox {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .failure {
    margin: 0;
    color: var(--color-danger);
  }

  .commands {
    display: flex;
    gap: var(--space-2);
  }

  .commands button {
    padding: var(--space-2) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .commands .primary {
    color: var(--color-accent-fg);
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .commands button:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
