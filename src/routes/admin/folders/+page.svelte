<!--
  The music folders of the server (p23 A, k28, k09, k19).

  Every row shows the folder icon, the name, the path it is scanned from, the
  account whose library it joins and whether it is watched. The status line says
  what the server last did with it: the live scan reports itself through the
  event stream, with a k09 bar under the line while it runs, and a failure stays
  in the row until the next scan. The row menu edits the folder or starts a scan.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import FolderDialog from '#lib/admin/FolderDialog.svelte';
  import { loadAllUsers } from '#lib/admin/api';
  import { lastScanText, ownerLabel, scanProgressText } from '#lib/admin/folders';
  import type { FolderView } from '#lib/admin/folders';
  import { problemMessage } from '#lib/admin/problem';
  import type { AdminUser } from '#lib/admin/users';
  import { nativeClient } from '#lib/api/native';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { events } from '#lib/stores/events.svelte';
  import type { ScanProgressPayload } from '#lib/stores/events.svelte';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import ProgressBar from '#lib/ui/ProgressBar.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  /** What the event stream last said about one folder's scan. */
  interface LiveScan {
    /** The line the row shows in place of its last result. */
    text: string;
    /** The percentage of the k09 bar, or `undefined` when the phase has no total. */
    percent: number | undefined;
    /** Whether the scan stopped with a failure. */
    failed: boolean;
  }

  const shell = getShellNavigation();

  let folders = $state<FolderView[]>([]);
  let users = $state<AdminUser[]>([]);
  let scans = $state<Record<string, LiveScan>>({});
  let failure = $state<string | null>(null);
  let loading = $state(true);
  let adding = $state(false);
  let editing = $state<FolderView | null>(null);

  const names = $derived(new Map(users.map((user) => [user.id, user.displayName])));

  onMount(() => {
    void load();
    void loadAllUsers().then((loaded) => (users = loaded));
    return events.on('scan.progress', (event) => {
      const id = event.data.folderId;
      if (event.data.phase === 'done' && event.data.error === undefined) {
        // The row's last result replaces the live line once the folder is read
        // again, so the finished counters never linger.
        const remaining = { ...scans };
        delete remaining[id];
        scans = remaining;
        void load();
        return;
      }
      scans = { ...scans, [id]: liveScan(event.data) };
    });
  });

  /**
   * Words one progress event for the row that shows it.
   *
   * @param progress The progress the server published.
   * @returns The line, the bar's value where the phase counts files, and
   *   whether the scan failed.
   */
  function liveScan(progress: ScanProgressPayload): LiveScan {
    const counted = progress.phase === 'indexing' && progress.filesSeen > 0;
    return {
      text: scanProgressText(progress),
      percent: counted ? Math.round((progress.filesDone / progress.filesSeen) * 100) : undefined,
      failed: progress.error !== undefined
    };
  }

  /** Loads every folder. */
  async function load(): Promise<void> {
    loading = true;
    const answer = await nativeClient.GET('/api/v1/admin/folders');
    loading = false;
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
  <title>Music Folders - Hearthsound</title>
</svelte:head>

{#snippet actions()}
  <Button
    variant="suggested"
    header
    icon="adwaita-add"
    label="Add Folder"
    onclick={() => (adding = true)}
  >
    Add Folder
  </Button>
{/snippet}

{#snippet retryAction()}
  <Button onclick={() => void load()}>Retry</Button>
{/snippet}

<PageHeader
  title="Music Folders"
  class="admin-header"
  onnavigation={shell?.openNavigation}
  {actions}
/>

<div class="content">
  {#if failure !== null}
    <StatusPage
      level={2}
      alert
      icon="adwaita-error"
      title="Could Not Load This Page"
      text="The server did not answer. Try again in a moment."
      action={retryAction}
    />
  {:else if folders.length === 0 && !loading}
    <p class="empty">No folders yet.</p>
  {:else}
    <ul class="hs-settings-group rows" aria-label="Music Folders">
      {#each folders as folder (folder.id)}
        {@const live = scans[folder.id]}
        {@const failed = live?.failed === true}
        {@const scanning = live !== undefined && !live.failed}
        {@const status = live?.text ?? lastScanText(folder.lastScanAt)}
        <li class="hs-setting-row folder">
          <Icon name="adwaita-folder" class="hs-setting-row__icon" />
          <div class="hs-setting-row__text">
            <span>{folder.name}</span>
            <span class="hs-setting-row__subtitle hs-setting-row__subtitle--mono">
              {folder.path}
            </span>
            <span class="hs-setting-row__subtitle">
              {ownerLabel(folder, names)}{folder.watch ? ' - Watch for changes' : ''}
            </span>
            <span
              class="hs-setting-row__subtitle"
              class:hs-setting-row__subtitle--error={failed}
              role="status"
            >
              {status}
            </span>
            {#if scanning}
              <div class="bar">
                <ProgressBar label="Scanning" value={live?.percent} />
              </div>
            {/if}
          </div>
          <Menu label="More Actions" align="end">
            <MenuItem label="Edit" icon="adwaita-edit" onselect={() => (editing = folder)} />
            <MenuItem
              label="Scan"
              icon="adwaita-refresh"
              onselect={() => void scan(folder, false)}
            />
            <MenuItem
              label="Full Scan"
              icon="adwaita-refresh"
              onselect={() => void scan(folder, true)}
            />
          </Menu>
        </li>
      {/each}

      {#if loading && folders.length === 0}
        {#each [0, 1, 2] as row (row)}
          <li class="hs-setting-row" aria-hidden="true">
            <Skeleton width="16px" height="16px" />
            <span class="hs-setting-row__text">
              <Skeleton width="30%" height="12px" />
              <Skeleton width="75%" height="10px" />
              <Skeleton width="45%" height="10px" />
            </span>
          </li>
        {/each}
      {/if}
    </ul>
  {/if}
</div>

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
  /* Layout glue only: the shell already holds the page off the window edge, so
     the k25 header aligns to that margin. The class lands on the component's
     own header, hence `:global`. */
  :global(.admin-header) {
    padding-inline: 0;
  }

  /* Layout glue only: p23 puts the group directly under the header and leaves
     the page 28 px at the bottom. */
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    padding-block: 0 var(--hs-space-7);
  }

  /* Layout glue only: the group clips its overflow to round its corners, which
     would cut off a row's menu popover. */
  .rows {
    max-width: 760px;
    overflow: visible;
  }

  /* p23 gives the folder row more air and starts its icon and its menu at the
     first and middle lines of the text. */
  .folder {
    align-items: flex-start;
    padding-block: 12px;
  }

  .folder > :global(.hs-setting-row__icon) {
    margin-top: 2px;
  }

  .folder :global(.menu-anchor) {
    align-self: center;
  }

  /* The k09 bar under the status line; p23 bounds it at 420 px. */
  .bar {
    display: block;
    margin-top: 6px;
    max-width: 420px;
  }

  /* The muted empty line of p23; the package has no page-text empty class. */
  .empty {
    margin: 0;
    color: var(--hs-fg-muted);
  }
</style>
