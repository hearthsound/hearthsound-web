<!--
  The music folders of the server.

  Every folder shows the path it is scanned from, the name it is listed under,
  the account whose library it joins, whether it is watched, and when it was
  last scanned. A scan started here reports itself line by line through the
  event stream, so the row says what the server is doing with it right now.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import FolderDialog from '#lib/admin/FolderDialog.svelte';
  import { loadAllUsers } from '#lib/admin/api';
  import { ownerLabel, scanProgressText } from '#lib/admin/folders';
  import type { FolderView } from '#lib/admin/folders';
  import { problemMessage } from '#lib/admin/problem';
  import type { AdminUser } from '#lib/admin/users';
  import { nativeClient } from '#lib/api/native';
  import { events } from '#lib/stores/events.svelte';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';

  let folders = $state<FolderView[]>([]);
  let users = $state<AdminUser[]>([]);
  let scans = $state<Record<string, string>>({});
  let failure = $state<string | null>(null);
  let adding = $state(false);
  let editing = $state<FolderView | null>(null);

  const names = $derived(new Map(users.map((user) => [user.id, user.displayName])));

  onMount(() => {
    void load();
    void loadAllUsers().then((loaded) => (users = loaded));
    return events.on('scan.progress', (event) => {
      scans = { ...scans, [event.data.folderId]: scanProgressText(event.data) };
      if (event.data.phase === 'done' && event.data.error === undefined) {
        void load();
      }
    });
  });

  /** Loads every folder. */
  async function load(): Promise<void> {
    const answer = await nativeClient.GET('/api/v1/admin/folders');
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not load the folders.');
      return;
    }
    failure = null;
    folders = answer.data.folders;
  }

  /**
   * Adds a folder the server just accepted.
   *
   * @param folder The folder.
   */
  function added(folder: FolderView): void {
    adding = false;
    folders = [...folders, folder];
  }

  /**
   * Replaces a folder the server just changed.
   *
   * @param folder The folder as it is now.
   */
  function saved(folder: FolderView): void {
    editing = null;
    folders = folders.map((existing) => (existing.id === folder.id ? folder : existing));
  }

  /**
   * Queues a scan of one folder.
   *
   * @param folder The folder to scan.
   * @param full Whether to re-read every file instead of the changed ones.
   */
  async function scan(folder: FolderView, full: boolean): Promise<void> {
    const answer = await nativeClient.POST('/api/v1/admin/folders/{id}/scan', {
      params: { path: { id: folder.id } },
      body: { full }
    });
    if (answer.data === undefined) {
      toasts.push(problemMessage(answer.error, 'Could not start the scan.'), 'error');
    }
  }
</script>

<svelte:head>
  <title>Folders - Hearthsound</title>
</svelte:head>

<section class="page">
  <header class="header">
    <h1>Music folders</h1>
    <button type="button" onclick={() => (adding = true)}>Add folder</button>
  </header>

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
        <th scope="col">Last scan</th>
        <th scope="col"><span class="visually-hidden">Commands</span></th>
      </tr>
    </thead>
    <tbody>
      {#each folders as folder (folder.id)}
        <tr>
          <td class="path">{folder.path}</td>
          <td>{folder.name}</td>
          <td>{ownerLabel(folder, names)}</td>
          <td>{folder.watch ? 'Yes' : 'No'}</td>
          <td>
            {folder.lastScanAt === undefined || folder.lastScanAt === null
              ? 'Never'
              : new Date(folder.lastScanAt).toLocaleString()}
          </td>
          <td class="commands">
            <button type="button" onclick={() => (editing = folder)}>Edit</button>
            <button type="button" onclick={() => scan(folder, false)}>Scan</button>
            <button type="button" onclick={() => scan(folder, true)}>Full scan</button>
          </td>
        </tr>
        {#if scans[folder.id] !== undefined}
          <tr class="progress-row">
            <td colspan="6" class="progress"><span role="status">{scans[folder.id]}</span></td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>

  {#if folders.length === 0 && failure === null}
    <p class="hint">No folders yet.</p>
  {/if}
</section>

{#if adding}
  <FolderDialog
    folder={null}
    {users}
    defaultOwner={session.user?.id ?? ''}
    onclose={() => (adding = false)}
    onsaved={added}
  />
{/if}

{#if editing !== null}
  <FolderDialog
    folder={editing}
    {users}
    defaultOwner={session.user?.id ?? ''}
    onclose={() => (editing = null)}
    onsaved={saved}
  />
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: baseline;
    justify-content: space-between;
  }

  .header h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .header button,
  .commands button {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .header button:hover,
  .commands button:hover {
    color: var(--color-accent);
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

  .table th {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .path {
    font-family: var(--font-mono);
  }

  .commands {
    display: flex;
    gap: var(--space-1);
    justify-content: flex-end;
  }

  .progress-row td {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .failure {
    margin: 0;
    color: var(--color-danger);
  }

  .hint {
    margin: 0;
    color: var(--color-fg-muted);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
