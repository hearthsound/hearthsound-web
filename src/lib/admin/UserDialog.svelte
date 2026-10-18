<!--
  The account dialog: the sign-in name of a new account, the name clients show,
  an optional password, the administrator flag, the three permissions and the
  daily quota.

  An empty quota field means the account is unlimited there, and an empty
  password on an edit keeps the stored one, which the hint beside the field
  says.
-->
<script lang="ts">
  import { untrack } from 'svelte';

  import { nativeClient } from '#lib/api/native';

  import Dialog from './Dialog.svelte';
  import { problemMessage } from './problem';
  import { emptyUserFields, newUserBody, userFields, userPatchBody } from './users';
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
  let fields = $state<UserFields>(
    untrack(() => (user === null ? emptyUserFields() : userFields(user)))
  );
  let failure = $state<string | null>(null);
  let busy = $state(false);

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
</script>

<Dialog title={editing ? 'Edit user' : 'Create user'} {onclose}>
  <form class="form" onsubmit={save}>
    <label class="field">
      <span class="field-label">Username</span>
      <input class="input" bind:value={fields.username} disabled={editing} required />
    </label>

    <label class="field">
      <span class="field-label">Display name</span>
      <input class="input" bind:value={fields.displayName} required />
    </label>

    <label class="field">
      <span class="field-label">Password</span>
      <input
        class="input"
        type="password"
        autocomplete="new-password"
        bind:value={fields.password}
        required={!editing}
      />
      {#if editing}
        <span class="field-hint">Leave empty to keep the current password.</span>
      {/if}
    </label>

    <label class="checkbox">
      <input type="checkbox" bind:checked={fields.isAdmin} />
      <span>Administrator</span>
    </label>

    <fieldset class="permissions">
      <legend class="field-label">Permissions</legend>
      <label class="checkbox">
        <input type="checkbox" bind:checked={fields.acquire} />
        <span>May acquire songs</span>
      </label>
      <label class="checkbox">
        <input type="checkbox" bind:checked={fields.download} />
        <span>May download files</span>
      </label>
      <label class="checkbox">
        <input type="checkbox" bind:checked={fields.upload} />
        <span>May upload files</span>
      </label>
    </fieldset>

    <fieldset class="quota">
      <legend class="field-label">Daily quota</legend>
      <label class="field">
        <span class="field-hint">Acquisitions per day</span>
        <input class="input" type="number" min="0" bind:value={fields.acquisitionsPerDay} />
      </label>
      <label class="field">
        <span class="field-hint">Bytes per day</span>
        <input class="input" type="number" min="0" bind:value={fields.acquisitionBytesPerDay} />
      </label>
      <p class="field-hint">An empty field means the quota is unlimited.</p>
    </fieldset>

    {#if failure !== null}
      <p class="failure" role="alert">{failure}</p>
    {/if}

    <div class="commands">
      <button class="primary" type="submit" disabled={busy}>
        {editing ? 'Save changes' : 'Create user'}
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

  .input {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .input:disabled {
    background: var(--color-bg-sunken);
    color: var(--color-fg-muted);
  }

  .checkbox {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .permissions,
  .quota {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
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
