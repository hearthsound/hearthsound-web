<!--
  The music folders step: where the library is scanned from.

  A folder belongs to the account it is added for, which is the administrator
  the wizard just created, or to nobody when it is Generic. Every row's menu
  edits the folder or removes it behind the same confirmation the admin views
  draw, so a folder added by mistake does not have to survive the wizard. The
  step may be left with nothing added, and more folders can be added later under
  the admin views.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import FolderDialog from '#lib/admin/FolderDialog.svelte';
  import { deleteFolder, listFolders } from '#lib/admin/api/folders';
  import { loadAllUsers } from '#lib/admin/api/users';
  import { ownerLabel } from '#lib/admin/folders';
  import type { FolderView } from '#lib/admin/folders';
  import type { AdminUser } from '#lib/admin/users';
  import { toasts } from '#lib/stores/toasts.svelte';

  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import ListRow from '#lib/ui/ListRow.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import SetupFooter from './SetupFooter.svelte';

  /** Props of the step. */
  interface Props {
    /** The account a new folder belongs to unless the dialog is changed. */
    ownerId: string;
    /** Moves on to the next step. */
    oncontinue: () => void;
    /** Moves back to the previous step. */
    onback?: () => void;
  }

  let { ownerId, oncontinue, onback }: Props = $props();

  let folders = $state<FolderView[]>([]);
  let users = $state<AdminUser[]>([]);
  let failure = $state<string | null>(null);
  let adding = $state(false);
  let editing = $state<FolderView | null>(null);
  let removing = $state<FolderView | null>(null);
  let removingBusy = $state(false);
  /** The server's refusal of the removal the confirmation asked for. */
  let removalFailure = $state<string | null>(null);

  const names = $derived(new Map(users.map((user) => [user.id, user.displayName])));

  onMount(async () => {
    void loadAllUsers().then((loaded) => {
      if (loaded.ok) {
        users = loaded.value;
      }
    });
    const result = await listFolders();
    if (!result.ok) {
      failure = result.message;
      return;
    }
    folders = result.value;
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

  /**
   * Replaces a folder the server just changed.
   *
   * @param folder The folder as it is now.
   */
  function saved(folder: FolderView): void {
    editing = null;
    folders = folders.map((existing) => (existing.id === folder.id ? folder : existing));
  }

  /** Closes the removal confirmation and forgets its refusal. */
  function closeRemoval(): void {
    removing = null;
    removalFailure = null;
  }

  /**
   * Removes the folder the confirmation shows.
   *
   * A refusal keeps the confirmation open with the server's sentence, so the
   * reader can try again or cancel.
   */
  async function remove(): Promise<void> {
    const folder = removing;
    if (folder === null) {
      return;
    }
    removingBusy = true;
    const result = await deleteFolder(folder.id);
    removingBusy = false;
    if (!result.ok) {
      removalFailure = result.message;
      return;
    }
    folders = folders.filter((existing) => existing.id !== folder.id);
    closeRemoval();
    toasts.push(`Removed ${folder.name}.`);
  }
</script>

<section class="hs-form">
  <div class="hs-setup">
    <h2 class="hs-title-3 step-title">Music folders</h2>
    <p class="step-lead">
      Hearthsound scans the directories added here and serves what it finds. A folder belongs to the
      account whose library it joins, or to nobody when it is Generic.
    </p>

    {#if failure !== null}
      <Banner level="error" text={failure} />
    {/if}

    <fieldset class="hs-settings-group folders">
      <legend class="hs-visually-hidden">Music folders</legend>

      {#if folders.length === 0 && failure === null}
        <div class="hs-setting-row">
          <span class="hs-setting-row__subtitle">
            No folder yet. Continue without one and add it later under the admin views.
          </span>
        </div>
      {/if}

      {#each folders as folder (folder.id)}
        <div class="hs-setting-row hs-setting-row--two-line">
          <Icon name="adwaita-folder" class="hs-setting-row__icon" />
          <span class="hs-setting-row__text">
            <span>{folder.name}</span>
            <span class="hs-setting-row__subtitle hs-setting-row__subtitle--mono path">
              {folder.path}
            </span>
            {#if folder.watch}
              <span class="hs-setting-row__subtitle">Watch for changes</span>
            {/if}
          </span>
          <span class="hs-setting-row__value">{ownerLabel(folder, names)}</span>
          <Menu label="More Actions" align="end">
            <MenuItem label="Edit" icon="adwaita-edit" onselect={() => (editing = folder)} />
            <MenuItem
              label="Remove Folder"
              icon="adwaita-delete"
              destructive
              onselect={() => (removing = folder)}
            />
          </Menu>
        </div>
      {/each}

      <ListRow title="Add folder" button icon="adwaita-add" onclick={() => (adding = true)} />
    </fieldset>

    <SetupFooter {onback}>
      <Button variant="suggested" onclick={oncontinue}>Continue</Button>
    </SetupFooter>
  </div>
</section>

{#if adding}
  <FolderDialog
    folder={null}
    {users}
    defaultOwner={ownerId}
    createLabel="Add folder"
    onclose={() => (adding = false)}
    onsaved={added}
  />
{/if}

{#if editing !== null}
  <FolderDialog
    folder={editing}
    {users}
    defaultOwner={ownerId}
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
    {#if removalFailure !== null}
      <Banner level="error" text={removalFailure} />
    {:else}
      <span aria-hidden="true"></span>
    {/if}

    {#snippet footer()}
      <Button disabled={removingBusy} onclick={closeRemoval}>Cancel</Button>
      <Button
        variant="destructive"
        busy={removingBusy}
        disabled={removingBusy}
        onclick={() => void remove()}
      >
        Remove Folder
      </Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  .step-title,
  .step-lead {
    margin: 0;
  }

  .path {
    overflow-wrap: anywhere;
  }

  .folders {
    border: 0;
    min-inline-size: 0;
  }
</style>
