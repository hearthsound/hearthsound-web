<!--
  The account's own password (E-B-1).

  Three fields in one form: the password the account has now, the one to store
  and the one typed again. The client checks the entered values in the order the
  server would refuse them - nothing in the current field, nothing in the new
  one, a new one under eight characters, a repetition that differs - and only
  then sends. A server refusal keeps the form usable: `wrong-password` clears the
  current field and shows the server's own sentence under it, a rate limit shows
  its detail in a banner, and any other problem is a banner too. A change ends
  every other session and every API key and app password of the account, which
  the page says above this form.

  Usage: `<PasswordForm />`
-->
<script lang="ts">
  import { tick } from 'svelte';

  import { changePassword } from '#lib/account/password';
  import { passwordLengthProblem } from '#lib/password';
  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import TextField from '#lib/ui/TextField.svelte';

  const uid = $props.id();
  const currentId = $derived(`account-current-password-${uid}`);
  const newId = $derived(`account-new-password-${uid}`);
  const repeatId = $derived(`account-repeat-password-${uid}`);
  const formId = $derived(`account-password-form-${uid}`);

  let current = $state('');
  let next = $state('');
  let repeat = $state('');

  /** The error under the current field. */
  let currentError = $state<string | null>(null);
  /** The error under the new field. */
  let newError = $state<string | null>(null);
  /** The error under the repetition field. */
  let repeatError = $state<string | null>(null);
  /** The problem a refused change answered with, shown above the fields. */
  let failure = $state<string | null>(null);
  /** Whether the change is in progress. */
  let busy = $state(false);
  /** Whether the change just succeeded. */
  let changed = $state(false);

  /** Drops every message, so a new attempt starts clean. */
  function clearMessages(): void {
    currentError = null;
    newError = null;
    repeatError = null;
    failure = null;
    changed = false;
  }

  /**
   * Checks the entered values in the order the server refuses them.
   *
   * @returns The field the first problem belongs to and its sentence, or `null`
   *   when the change may be sent.
   */
  function firstProblem(): { field: 'current' | 'new' | 'repeat'; text: string } | null {
    if (current === '') {
      return { field: 'current', text: 'Choose your current password.' };
    }
    if (next === '') {
      return { field: 'new', text: 'Choose a new password.' };
    }
    const tooShort = passwordLengthProblem(next);
    if (tooShort !== null) {
      return { field: 'new', text: tooShort };
    }
    if (next !== repeat) {
      return { field: 'repeat', text: 'The passwords do not match.' };
    }
    return null;
  }

  /**
   * Changes the password from the entered fields.
   *
   * @param event The form submission.
   */
  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    clearMessages();
    const problem = firstProblem();
    if (problem !== null) {
      if (problem.field === 'current') {
        currentError = problem.text;
      } else if (problem.field === 'new') {
        newError = problem.text;
      } else {
        repeatError = problem.text;
      }
      const id =
        problem.field === 'current' ? currentId : problem.field === 'new' ? newId : repeatId;
      await tick();
      document.getElementById(id)?.focus();
      return;
    }
    busy = true;
    const result = await changePassword(current, next);
    busy = false;
    if (result.ok) {
      current = '';
      next = '';
      repeat = '';
      changed = true;
      return;
    }
    if (result.code === 'wrong-password') {
      current = '';
      currentError = result.message;
      await tick();
      document.getElementById(currentId)?.focus();
      return;
    }
    failure = result.message;
  }
</script>

{#if changed}
  <Banner level="success" text="Password changed." />
{/if}

{#if failure !== null}
  <Banner level="error" text={failure} />
{/if}

<form id={formId} class="hs-form" novalidate onsubmit={submit}>
  <FormField label="Current password" for={currentId} error={currentError ?? undefined}>
    <TextField
      id={currentId}
      kind="password"
      bind:value={current}
      autocomplete="current-password"
      invalid={currentError !== null}
      required
    />
  </FormField>

  <FormField label="New password" for={newId} error={newError ?? undefined}>
    <TextField
      id={newId}
      kind="password"
      bind:value={next}
      autocomplete="new-password"
      invalid={newError !== null}
      required
    />
  </FormField>

  <FormField label="Repeat the new password" for={repeatId} error={repeatError ?? undefined}>
    <TextField
      id={repeatId}
      kind="password"
      bind:value={repeat}
      autocomplete="new-password"
      invalid={repeatError !== null}
      required
    />
  </FormField>

  <div class="commands">
    <Button variant="suggested" type="submit" form={formId} {busy} disabled={busy}>
      Change Password
    </Button>
  </div>
</form>

<style>
  .commands {
    display: flex;
    justify-content: flex-end;
  }
</style>
