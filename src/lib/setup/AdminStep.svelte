<!--
  The administrator step: the account the server waits for.

  The one-time token travels in the setup link, so the form does not ask for it;
  a link without one shows the k22 status page that says where to find it,
  instead of offering a form that cannot be answered.
-->
<script lang="ts">
  import { tick } from 'svelte';

  import { problemMessage } from '#lib/admin/problem';
  import { usernameProblem } from '#lib/admin/users';
  import type { components } from '#lib/api/schema';
  import { nativeClient } from '#lib/api/native';
  import { passwordProblem } from '#lib/setup/steps';

  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import TextField from '#lib/ui/TextField.svelte';
  import SetupFooter from './SetupFooter.svelte';

  /** The session the server started for the administrator it created. */
  type StartedSession = components['schemas']['LoginResponse'];

  /** Props of the step. */
  interface Props {
    /** The token the setup link carried, when it carried one. */
    token: string | null;
    /** Receives the session the server answered the setup with. */
    onsubmitted: (session: StartedSession) => void;
  }

  let { token, onsubmitted }: Props = $props();

  const uid = $props.id();
  const usernameId = $derived(`admin-username-${uid}`);
  const displayNameId = $derived(`admin-display-name-${uid}`);
  const passwordId = $derived(`admin-password-${uid}`);
  const confirmationId = $derived(`admin-confirmation-${uid}`);
  const formId = $derived(`admin-form-${uid}`);

  let username = $state('admin');

  let displayName = $state('');
  let password = $state('');
  let confirmation = $state('');
  let passwordError = $state<string | null>(null);
  let confirmationError = $state<string | null>(null);
  let failure = $state<string | null>(null);
  let busy = $state(false);

  /** What is wrong with the typed username, or `null` when it is allowed. */
  const usernameError = $derived(usernameProblem(username));
  const canSubmit = $derived(usernameError === null);

  /**
   * Creates the administrator from the entered fields.
   *
   * @param event The form submission.
   */
  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }
    const problem = passwordProblem(password, confirmation);
    if (problem !== null) {
      passwordError = password === '' ? problem : null;
      confirmationError = password === '' ? null : problem;
      await tick();
      document.getElementById(password === '' ? passwordId : confirmationId)?.focus();
      return;
    }
    passwordError = null;
    confirmationError = null;
    busy = true;
    const name = displayName.trim();
    const answer = await nativeClient.POST('/api/v1/setup', {
      body: {
        token: token ?? '',
        username: username.trim(),
        displayName: name === '' ? null : name,
        password
      }
    });
    busy = false;
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not create the administrator.');
      return;
    }
    onsubmitted(answer.data);
  }
</script>

<section class="hs-form">
  <div class="hs-setup">
    {#if token === null}
      <StatusPage level={2} icon="adwaita-lock" title="This server has no administrator yet.">
        <p class="hs-status-page__text">
          It printed a one-time setup link when it started: open the line holding a
          <code class="hs-inline-code">/setup?token=...</code> address from its log in this browser, and
          the wizard continues here. Starting the server again prints a new link, and the link stops working
          once an administrator exists.
        </p>
      </StatusPage>
    {:else}
      <h2 class="hs-title-3 step-title">Administrator</h2>
      <p class="step-lead">
        This account administers the server: it manages the users, the folders, the plugins and the
        settings. The username and the password are also how you sign in.
      </p>

      <form id={formId} class="hs-form" onsubmit={submit}>
        <FormField
          label="Username"
          for={usernameId}
          error={usernameError ?? undefined}
          hint={usernameError === null
            ? 'Letters, digits, dots, dashes and underscores.'
            : undefined}
        >
          <TextField
            id={usernameId}
            bind:value={username}
            autocomplete="username"
            invalid={usernameError !== null}
            required
          />
        </FormField>

        <FormField label="Display name" for={displayNameId} hint="Shown in the interface">
          <TextField id={displayNameId} bind:value={displayName} />
        </FormField>

        <FormField label="Password" for={passwordId} error={passwordError ?? undefined}>
          <TextField
            id={passwordId}
            kind="password"
            bind:value={password}
            autocomplete="new-password"
            invalid={passwordError !== null}
            aria-describedby={passwordError === null ? undefined : `${passwordId}-error`}
            required
          />
        </FormField>

        <FormField
          label="Repeat the password"
          for={confirmationId}
          error={confirmationError ?? undefined}
        >
          <TextField
            id={confirmationId}
            kind="password"
            bind:value={confirmation}
            autocomplete="new-password"
            invalid={confirmationError !== null}
            aria-describedby={confirmationError === null ? undefined : `${confirmationId}-error`}
            required
          />
        </FormField>

        {#if failure !== null}
          <Banner level="error" text={failure} />
        {/if}
      </form>

      <SetupFooter>
        <Button
          variant="suggested"
          type="submit"
          form={formId}
          {busy}
          disabled={busy || !canSubmit}
        >
          Create the administrator
        </Button>
      </SetupFooter>
    {/if}
  </div>
</section>

<style>
  .step-title,
  .step-lead {
    margin: 0;
  }
</style>
