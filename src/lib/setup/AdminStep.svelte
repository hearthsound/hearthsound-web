<!--
  The administrator step: the account the server waits for.

  The one-time token travels in the setup link, so the form does not ask for it;
  a link without one shows the k22 status page that says where to find it,
  instead of offering a form that cannot be answered. The link is validated
  before the form is drawn: a link the pre-flight check calls invalid shows the
  same page, and so does a link the server refuses on submit as spent - the
  token was used once already - so the reader is told where the newest link
  comes from rather than pressing a button that cannot work.
-->
<script lang="ts">
  import { tick } from 'svelte';

  import { usernameProblem } from '#lib/admin/users';
  import type { components } from '#lib/api/schema';
  import { completeSetup } from '#lib/setup/api';
  import type { SetupTokenState } from '#lib/setup/api';
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
    /** What the pre-flight check of that link answered. */
    tokenState: SetupTokenState;
    /** Receives the session the server answered the setup with. */
    onsubmitted: (session: StartedSession) => void;
  }

  let { token, tokenState, onsubmitted }: Props = $props();

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
  /** Whether the server refused the submitted link as spent. */
  let dead = $state(false);
  /** Whether the link cannot be used: the check refused it, or the submit did. */
  const unusable = $derived(dead || tokenState === 'invalid');

  /** Whether the username field has been left. */
  let usernameTouched = $state(false);
  /** What is wrong with the typed username, or `null` when it is allowed. */
  const usernameProblemText = $derived(usernameProblem(username));
  /** The error under the field, shown only once the reader has left it. */
  const usernameError = $derived(usernameTouched ? usernameProblemText : null);

  /**
   * Creates the administrator from the entered fields.
   *
   * @param event The form submission.
   */
  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    if (usernameProblemText !== null) {
      usernameTouched = true;
      return;
    }
    const problem = passwordProblem(password, confirmation);
    if (problem !== null) {
      // The mismatch belongs to the field that repeats the password; an empty
      // or too-short one belongs to the password field itself.
      const mismatch = problem === 'The passwords do not match.';
      passwordError = mismatch ? null : problem;
      confirmationError = mismatch ? problem : null;
      await tick();
      document.getElementById(mismatch ? confirmationId : passwordId)?.focus();
      return;
    }
    passwordError = null;
    confirmationError = null;
    busy = true;
    const name = displayName.trim();
    const result = await completeSetup({
      token: token ?? '',
      username: username.trim(),
      displayName: name === '' ? null : name,
      password
    });
    busy = false;
    if (!result.ok) {
      if (result.status === 401 || result.status === 409) {
        // A setup link works once: the server refused it as spent, so the form
        // cannot be answered and the typed passwords are dropped.
        dead = true;
        failure = null;
        password = '';
        confirmation = '';
        return;
      }
      failure = result.message;
      return;
    }
    onsubmitted(result.value);
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
    {:else if unusable}
      <StatusPage level={2} icon="adwaita-lock" title="This setup link is not valid.">
        <p class="hs-status-page__text">
          Use the newest link from the server log; restarting the server prints a new one.
        </p>
      </StatusPage>
    {:else}
      <h2 class="hs-title-3 step-title">Administrator</h2>
      <p class="step-lead">
        This account administers the server: it manages the users, the folders, the plugins and the
        settings. The username and the password are also how you sign in.
      </p>

      <form id={formId} class="hs-form" novalidate onsubmit={submit}>
        <FormField label="Username" for={usernameId} error={usernameError ?? undefined}>
          <TextField
            id={usernameId}
            bind:value={username}
            autocomplete="username"
            invalid={usernameError !== null}
            onblur={() => (usernameTouched = true)}
            required
          />
        </FormField>

        <FormField label="Display name" for={displayNameId}>
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
        <Button variant="suggested" type="submit" form={formId} {busy} disabled={busy}>
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
