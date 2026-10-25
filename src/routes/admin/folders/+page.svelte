<!--
  The music folders of the server (p23 A, k28, k09, k19).

  Every row shows the folder icon, the name, the path it is scanned from, the
  account whose library it joins and whether it is watched. The status line says
  what the server last did with it: the live scan reports itself through the
  event stream, with a k09 bar under the line while it runs, and the failure of
  the last stored scan stays in the row in the error style, above the last
  successful one, until the next scan. The row menu edits the folder or starts a
  scan.

  Removing a folder first reads what the removal would take with it, then asks
  and names the likes and playlist entries that go with the folder's songs; the
  confirmation's "Don't ask again" stores `library.confirm_folder_removal`, so
  the servers whose administrator switched it off remove at once.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import FolderDialog from '#lib/admin/FolderDialog.svelte';
  import {
    deleteFolder,
    folderRemovalImpact,
    listFolders,
    scanFolder
  } from '#lib/admin/api/folders';
  import { listSettings, saveSettings } from '#lib/admin/api/settings';
  import { loadAllUsers } from '#lib/admin/api/users';
  import {
    confirmsFolderRemoval,
    failedScanText,
    lastScanText,
    ownerLabel,
    removalImpactText,
    scanProgressText
  } from '#lib/admin/folders';
  import type { FolderRemovalImpact, FolderView } from '#lib/admin/folders';
  import { settingPatch } from '#lib/admin/settings';
  import type { ServerSetting } from '#lib/admin/settings';
  import type { AdminUser } from '#lib/admin/users';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { events } from '#lib/stores/events.svelte';
  import type { ScanProgressPayload } from '#lib/stores/events.svelte';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Checkbox from '#lib/ui/Checkbox.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
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
  let settings = $state<ServerSetting[]>([]);
  let scans = $state<Record<string, LiveScan>>({});
  let failure = $state<string | null>(null);
  let loading = $state(true);
  let adding = $state(false);
  let editing = $state<FolderView | null>(null);
  let removing = $state<FolderView | null>(null);
  let removingBusy = $state(false);
  /** What the removal preview reported for the folder the confirmation asks about. */
  let removalImpact = $state<FolderRemovalImpact | null>(null);
  /** Whether the confirmation's "Don't ask again" box is ticked. */
  let dontAskAgain = $state(false);

  const names = $derived(new Map(users.map((user) => [user.id, user.displayName])));
  /** Whether removing a folder asks first; a failed settings read still asks. */
  const confirmRemoval = $derived(confirmsFolderRemoval(settings));

  onMount(() => {
    void load();
    void loadAllUsers().then((loaded) => {
      if (loaded.ok) {
        users = loaded.value;
      }
    });
    void listSettings().then((loaded) => {
      if (loaded.ok) {
        settings = loaded.value;
      }
    });
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
    const result = await listFolders();
    loading = false;
    if (!result.ok) {
      failure = result.message;
      return;
    }
    failure = null;
    folders = result.value;
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
   * Asks what removing one folder would take with it, then opens the
   * confirmation.
   *
   * A preview that fails leaves the folder alone: the removal never runs
   * without the counts the confirmation names. When the stored setting switched
   * the question off, the folder is removed at once.
   *
   * @param folder The folder to remove.
   */
  async function askRemove(folder: FolderView): Promise<void> {
    if (!confirmRemoval) {
      await remove(folder);
      return;
    }
    const impact = await folderRemovalImpact(folder.id);
    if (!impact.ok) {
      toasts.push(impact.message, 'error');
      return;
    }
    removalImpact = impact.value;
    removing = folder;
  }

  /** Closes the confirmation and forgets what it held. */
  function closeRemoval(): void {
    removing = null;
    removalImpact = null;
    dontAskAgain = false;
  }

  /**
   * Removes one folder.
   *
   * The folder's file records and the tracks only it held go with it, together
   * with their likes and playlist entries; nothing inside the folder on disk is
   * touched. A ticked "Don't ask again" stores the setting once the removal
   * succeeded, which is why failing to store it only reports itself.
   *
   * @param folder The folder to remove.
   */
  async function remove(folder: FolderView): Promise<void> {
    removingBusy = true;
    const result = await deleteFolder(folder.id);
    removingBusy = false;
    if (!result.ok) {
      toasts.push(result.message, 'error');
      return;
    }
    folders = folders.filter((existing) => existing.id !== folder.id);
    toasts.push(`Removed ${folder.name}.`);
    const remembered = dontAskAgain;
    closeRemoval();
    if (!remembered) {
      return;
    }
    const saved = await saveSettings(settingPatch('library.confirm_folder_removal', false));
    if (!saved.ok) {
      toasts.push(saved.message, 'error');
      return;
    }
    settings = saved.value;
  }

  /**
   * Queues a scan of one folder.
   *
   * @param folder The folder to scan.
   * @param full Whether to re-read every file instead of the changed ones.
   */
  async function scan(folder: FolderView, full: boolean): Promise<void> {
    const result = await scanFolder(folder.id, full);
    if (!result.ok) {
      toasts.push(result.message, 'error');
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
        {@const storedFailure = failedScanText(folder)}
        {@const failed = live?.failed === true || (live === undefined && storedFailure !== null)}
        {@const scanning = live !== undefined && !live.failed}
        {@const status = live?.text ?? storedFailure ?? lastScanText(folder.lastScanAt)}
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
            {#if live === undefined && storedFailure !== null && folder.lastScanAt !== undefined && folder.lastScanAt !== null}
              <span class="hs-setting-row__subtitle">{lastScanText(folder.lastScanAt)}</span>
            {/if}
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
            <MenuItem
              label="Remove Folder"
              icon="adwaita-delete"
              destructive
              onselect={() => void askRemove(folder)}
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

{#if removing !== null}
  <Dialog
    title="Remove Folder?"
    alert
    onclose={closeRemoval}
    description={`${removing.name} leaves the library and its files stop appearing there. Nothing inside the folder on disk is deleted.`}
  >
    {#if removalImpact !== null}
      <p class="impact">{removalImpactText(removalImpact)}</p>
    {/if}
    <Checkbox label="Don't ask again" bind:checked={dontAskAgain} />

    {#snippet footer()}
      <Button disabled={removingBusy} onclick={closeRemoval}>Cancel</Button>
      <Button
        variant="destructive"
        busy={removingBusy}
        disabled={removingBusy}
        onclick={() => removing !== null && void remove(removing)}
      >
        Remove Folder
      </Button>
    {/snippet}
  </Dialog>
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

  /* Layout glue only: the counts and the box of the confirmation stack 10 px
     apart, which k19 leaves to the dialog's content. */
  .impact {
    margin: 0 0 10px;
  }

  /* The muted empty line of p23; the package has no page-text empty class. */
  .empty {
    margin: 0;
    color: var(--hs-fg-muted);
  }
</style>
