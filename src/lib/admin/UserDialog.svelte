<!--
  The account dialog: the sign-in name of a new account, the name clients show,
  an optional password, the administrator flag, the three permissions and the
  daily quota (p22, k19, k32).

  An empty quota field means the account is unlimited there, and an empty
  password on an edit keeps the stored one, which the hint beside the field
  says. Editing an enabled account adds the red Disable User row; a disabled
  account is enabled from its row menu instead.
-->
<script lang="ts">
  import { untrack } from 'svelte';

  import { nativeClient } from '#lib/api/native';

  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Checkbox from '#lib/ui/Checkbox.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import NumberField from '#lib/ui/NumberField.svelte';
  import TextField from '#lib/ui/TextField.svelte';
  import { problemMessage } from './problem';
  import { emptyUserFields, isDisabled, newUserBody, userFields, userPatchBody } from './users';
  import type { AdminUser, UserFields } from './users';

  /** Props of the dialog. */
  interface Props {
    /** The account to edit, or `null` to create one. */
    user: AdminUser | null;
    /** Closes the dialog. */
    onclose: () => void;
    /** Receives the account the server answered with. */
    onsaved: (user: AdminUser) => void;
  }

  let { user, onclose, onsaved }: Props = $props();

  const editing = untrack(() => user !== null);
  const uid = $props.id();
  const usernameId = `user-username-${uid}`;
  const displayId = `user-display-${uid}`;
  const passwordId = `user-password-${uid}`;
  const formId = `user-form-${uid}`;

  let fields = $state<UserFields>(
    untrack(() => (user === null ? emptyUserFields() : userFields(user)))
  );
  let failure = $state<string | null>(null);
  let busy = $state(false);

  const disabled = $derived(user !== null && isDisabled(user));

  /**
   * Saves the account the fields describe.
   *
   * @param event The form submission.
   */
  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    const answer =
      user === null
        ? await nativeClient.POST('/api/v1/admin/users', { body: newUserBody(fields) })
        : await nativeClient.PATCH('/api/v1/admin/users/{id}', {
            params: { path: { id: user.id } },
            body: userPatchBody(fields)
          });
    busy = false;
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not save the account.');
      return;
    }
    onsaved(answer.data);
  }

  /**
   * Disables the account the dialog shows and hands the changed account back.
   */
  async function disable(): Promise<void> {
    if (user === null) {
      return;
    }
    busy = true;
    const answer = await nativeClient.PATCH('/api/v1/admin/users/{id}', {
      params: { path: { id: user.id } },
      body: { disabled: true }
    });
    busy = false;
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not change the account.');
      return;
    }
    onsaved(answer.data);
  }
</script>

{#snippet footer()}
  <Button onclick={onclose}>Cancel</Button>
  <Button variant="suggested" type="submit" form={formId} {busy}>
    {editing ? 'Save changes' : 'Create User'}
  </Button>
{/snippet}

<Dialog title={editing ? 'Edit User' : 'Create User'} {onclose} {footer}>
  <form id={formId} class="form" onsubmit={save}>
    <FormField label="Username" for={usernameId}>
      <TextField
        id={usernameId}
        bind:value={fields.username}
        autocomplete="username"
        disabled={editing}
        required
      />
    </FormField>

    <FormField label="Display name" for={displayId}>
      <TextField id={displayId} bind:value={fields.displayName} autocomplete="name" required />
    </FormField>

    <FormField
      label="Password"
      for={passwordId}
      optional={editing}
      hint={editing ? 'Leave empty to keep the current password.' : undefined}
    >
      <TextField
        id={passwordId}
        kind="password"
        bind:value={fields.password}
        autocomplete="new-password"
        required={!editing}
      />
    </FormField>

    <Checkbox label="Administrator" bind:checked={fields.isAdmin} />

    <fieldset class="choices">
      <legend class="hs-form-field__label">Permissions</legend>
      <Checkbox label="May acquire songs" bind:checked={fields.acquire} />
      <Checkbox label="May download files" bind:checked={fields.download} />
      <Checkbox label="May upload files" bind:checked={fields.upload} />
    </fieldset>

    <fieldset class="choices quota">
      <legend class="hs-form-field__label">Daily quota</legend>

      <FormField label="Acquisitions per day" optional>
        <NumberField
          label="Acquisitions per day"
          min={0}
          value={Number(fields.acquisitionsPerDay) || 0}
          empty={fields.acquisitionsPerDay === ''}
          onchange={(value) => {
            fields.acquisitionsPerDay = value ?? '';
          }}
        />
      </FormField>

      <FormField label="Bytes per day" optional>
        <NumberField
          label="Bytes per day"
          min={0}
          value={Number(fields.acquisitionBytesPerDay) || 0}
          empty={fields.acquisitionBytesPerDay === ''}
          onchange={(value) => {
            fields.acquisitionBytesPerDay = value ?? '';
          }}
        />
      </FormField>

      <span class="hs-form-field__hint">An empty field means the quota is unlimited.</span>
    </fieldset>

    {#if failure !== null}
      <Banner level="error" text={failure} />
    {/if}

    {#if editing && !disabled}
      <button
        class="hs-setting-row hs-setting-row--button disable"
        type="button"
        disabled={busy}
        onclick={disable}
      >
        Disable User
      </button>
    {/if}
  </form>
</Dialog>

<style>
  /* Layout glue only: the form spaces the dialog's fields 14 px apart, as p22
     draws them. */
  .form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* A choice group without the browser's fieldset frame; the legend keeps the
     k32 field label. */
  .choices {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-2);
    margin: 0;
    padding: 0;
    border: 0;
  }

  .choices > legend {
    padding: 0;
  }

  /* The two quota fields carry their own k32 labels, so p22 spaces them like
     the form's fields rather than like the permission checkboxes. */
  .quota {
    gap: 14px;
  }

  /* Layout glue only: p22 draws the Disable User row on the group surface in
     --hs-error; hs-setting-row--button supplies the centred row but leaves the
     surface and the colour to the page. */
  .disable {
    width: 100%;
    border: 0;
    border-radius: var(--hs-radius-card);
    background: var(--hs-group-bg);
    color: var(--hs-error);
    cursor: pointer;
  }

  .disable:disabled {
    opacity: 0.4;
    cursor: default;
  }
</style>
