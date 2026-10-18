<!--
  The music folders step: where the library is scanned from.

  A folder belongs to the account it is added for, which is the administrator
  the wizard just created, or to nobody when it is Generic. The step may be left
  with nothing added, and more folders can be added later under the admin views.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import FolderDialog from '#lib/admin/FolderDialog.svelte';
  import { loadAllUsers } from '#lib/admin/api';
  import { ownerLabel } from '#lib/admin/folders';
  import type { FolderView } from '#lib/admin/folders';
  import { problemMessage } from '#lib/admin/problem';
  import type { AdminUser } from '#lib/admin/users';
  import { nativeClient } from '#lib/api/native';

  /** Props of the step. */
  interface Props {
    /** The account a new folder belongs to unless the dialog is changed. */
    ownerId: string;
    /** Moves on to the next step. */
    oncontinue: () => void;
  }

  let { ownerId, oncontinue }: Props = $props();

  let folders = $state<FolderView[]>([]);
  let users = $state<AdminUser[]>([]);
  let failure = $state<string | null>(null);
  let adding = $state(false);

  const names = $derived(new Map(users.map((user) => [user.id, user.displayName])));

  onMount(async () => {
    void loadAllUsers().then((loaded) => (users = loaded));
    const answer = await nativeClient.GET('/api/v1/admin/folders');
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not load the folders.');
      return;
    }
    folders = answer.data.folders;
  });

  /**
   * Adds a folder the server just accepted.
   *
   * @param folder The folder.
   */
  function added(folder: FolderView): void {
    adding = false;
    folders = [...folders, folder];
  }
</script>

<section class="step">
  <h2>Music folders</h2>
  <p>
    Hearthsound scans the directories added here and serves what it finds. A folder belongs to the
    account whose library it joins, or to nobody when it is Generic.
  </p>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  <table class="table">
    <thead>
      <tr>
        <th scope="col">Path</th>
        <th scope="col">Name</th>
        <th scope="col">Belongs to</th>
        <th scope="col">Watch</th>
      </tr>
    </thead>
    <tbody>
      {#each folders as folder (folder.id)}
        <tr>
          <td class="path">{folder.path}</td>
          <td>{folder.name}</td>
          <td>{ownerLabel(folder, names)}</td>
          <td>{folder.watch ? 'Yes' : 'No'}</td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if folders.length === 0 && failure === null}
    <p class="hint">No folder yet. Continue without one and add it later under the admin views.</p>
  {/if}

  <div class="commands">
    <button type="button" onclick={() => (adding = true)}>Add folder</button>
    <button class="primary" type="button" onclick={oncontinue}>Continue</button>
  </div>
</section>

{#if adding}
  <FolderDialog
    folder={null}
    {users}
    defaultOwner={ownerId}
    onclose={() => (adding = false)}
    onsaved={added}
  />
{/if}

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .step h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .step p {
    margin: 0;
  }

  .table {
    width: 100%;
    border-collapse: collapse;
  }

  .table th,
  .table td {
    padding: var(--space-2);
    text-align: left;
    border-bottom: var(--border-width) solid var(--color-border);
  }

  .path {
    font-family: var(--font-mono);
  }

  .hint {
    margin: 0;
    color: var(--color-fg-muted);
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
</style>
