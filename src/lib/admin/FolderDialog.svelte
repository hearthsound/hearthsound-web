<!--
  The music folder dialog: the path of a new folder, its display name, whether
  it is watched, and whether it belongs to an account or is generic (k19, k32,
  p03).

  A new folder belongs to the administrator who adds it unless the radio is
  switched to generic, and a generic folder has no owner to choose. The dialog
  is 340 px wide and becomes the phone bottom card.
-->
<script lang="ts">
  import { untrack } from 'svelte';

  import { nativeClient } from '#lib/api/native';

  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Checkbox from '#lib/ui/Checkbox.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import Radio from '#lib/ui/Radio.svelte';
  import Select from '#lib/ui/Select.svelte';
  import TextField from '#lib/ui/TextField.svelte';
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
    /**
     * The title and the command of the add dialog: the admin views draw
     * "Add Folder" (AF-02), the setup wizard p03's "Add folder" (SU-24).
     */
    createLabel?: string;
  }

  let {
    folder,
    users,
    defaultOwner,
    onclose,
    onsaved,
    createLabel = 'Add Folder'
  }: Props = $props();

  const editing = untrack(() => folder !== null);
  const uid = $props.id();
  const pathId = $derived(`folder-path-${uid}`);
  const nameId = $derived(`folder-name-${uid}`);

  let path = $state(untrack(() => folder?.path ?? ''));
  let name = $state(untrack(() => folder?.name ?? ''));
  let watch = $state(untrack(() => folder?.watch ?? true));
  let association = $state<'account' | 'generic'>(
    untrack(() => (folder?.generic === true ? 'generic' : 'account'))
  );
  let owner = $state(untrack(() => folder?.owner ?? defaultOwner));
  let failure = $state<string | null>(null);
  let busy = $state(false);

  const ownerOptions = $derived(users.map((user) => ({ value: user.id, label: user.username })));

  /**
   * Saves the folder the fields describe.
   *
   * @param event The form submission.
   */
  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    const associationFields = { generic: association === 'generic', owner };
    const answer =
      folder === null
        ? await nativeClient.POST('/api/v1/admin/folders', {
            body: newFolderBody(path, name, watch, associationFields)
          })
        : await nativeClient.PATCH('/api/v1/admin/folders/{id}', {
            params: { path: { id: folder.id } },
            body: folderPatchBody(name, watch, associationFields)
          });
    busy = false;
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not save the folder.');
      return;
    }
    onsaved(answer.data);
  }
</script>

{#snippet footer()}
  <Button onclick={onclose}>Cancel</Button>
  <Button variant="suggested" type="submit" form="folder-form-{uid}" {busy}>
    {editing ? 'Save changes' : createLabel}
  </Button>
{/snippet}

<Dialog title={editing ? 'Edit Folder' : createLabel} {onclose} {footer}>
  <form id="folder-form-{uid}" class="form" onsubmit={save}>
    {#if editing}
      <p class="hs-setting-row__subtitle hs-setting-row__subtitle--mono path">
        <span class="hs-visually-hidden">Path: </span>{folder?.path}
      </p>
    {:else}
      <FormField label="Path" for={pathId} hint="The absolute path of the folder on the server.">
        <TextField id={pathId} bind:value={path} required />
      </FormField>
    {/if}

    <FormField
      label="Name"
      for={nameId}
      optional={editing}
      hint="The name shown in this view; the directory name when empty."
    >
      <TextField id={nameId} bind:value={name} />
    </FormField>

    <fieldset class="choice-group">
      <legend class="hs-form-field__label">Belongs to</legend>

      <Radio name="association" value="account" label="An account" bind:group={association} />
      <div class="account">
        <Select
          label="An account"
          options={ownerOptions}
          bind:value={owner}
          disabled={association === 'generic'}
        />
      </div>
      <Radio name="association" value="generic" label="Generic" bind:group={association} />
    </fieldset>

    <Checkbox label="Watch for changes" bind:checked={watch} />

    {#if failure !== null}
      <Banner level="error" text={failure} />
    {/if}
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-5);
  }

  .path {
    margin: 0;
    overflow-wrap: anywhere;
  }

  .choice-group {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
    margin: 0;
    padding: 0;
    border: 0;
  }

  .choice-group > legend {
    padding: 0;
  }

  .account {
    margin-left: var(--hs-space-7);
  }
</style>
