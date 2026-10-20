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

  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import ListRow from '#lib/ui/ListRow.svelte';
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
    onclose={() => (adding = false)}
    onsaved={added}
  />
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
