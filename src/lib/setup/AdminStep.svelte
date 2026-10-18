<!--
  The administrator step: the account the server waits for.

  The one-time token travels in the setup link, so the form does not ask for it;
  a link without one says where to find it instead of offering a form that
  cannot be answered.
-->
<script lang="ts">
  import { problemMessage } from '#lib/admin/problem';
  import type { components } from '#lib/api/schema';
  import { nativeClient } from '#lib/api/native';
  import { passwordProblem } from '#lib/setup/steps';

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

  let username = $state('admin');
  let displayName = $state('');
  let password = $state('');
  let confirmation = $state('');
  let failure = $state<string | null>(null);
  let busy = $state(false);

  /**
   * Creates the administrator from the entered fields.
   *
   * @param event The form submission.
   */
  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const problem = passwordProblem(password, confirmation);
    if (problem !== null) {
      failure = problem;
      return;
    }
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

<section class="step">
  <h2>Administrator</h2>

  {#if token === null}
    <p>
      This server has no administrator yet. It printed a one-time setup link when it started: open
      the line holding a <code>/setup?token=...</code> address from its log in this browser, and the wizard
      continues here. Starting the server again prints a new link, and the link stops working once an
      administrator exists.
    </p>
  {:else}
    <p>
      This account administers the server: it manages the users, the folders, the plugins and the
      settings. The username and the password are also how you sign in.
    </p>

    <form class="form" onsubmit={submit}>
      <label class="field">
        <span>Username</span>
        <input bind:value={username} autocomplete="username" />
      </label>

      <label class="field">
        <span>Display name</span>
        <input bind:value={displayName} placeholder="Shown in the interface" />
      </label>

      <label class="field">
        <span>Password</span>
        <input type="password" bind:value={password} autocomplete="new-password" />
      </label>

      <label class="field">
        <span>Repeat the password</span>
        <input type="password" bind:value={confirmation} autocomplete="new-password" />
      </label>

      {#if failure !== null}
        <p class="failure" role="alert">{failure}</p>
      {/if}

      <div class="commands">
        <button class="primary" type="submit" disabled={busy}>Create the administrator</button>
      </div>
    </form>
  {/if}
</section>

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .step h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .step p {
    margin: 0;
  }

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

  .field input {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
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
