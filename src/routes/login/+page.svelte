<!--
  The sign-in form.

  A successful sign-in returns the browser to the route it was on when it was
  sent here, or to the personal library.
-->
<script lang="ts">
  import { navigate } from '#lib/navigation';
  import { session } from '#lib/stores/session.svelte';

  let username = $state('');
  let password = $state('');
  let failure = $state<string | null>(null);
  let busy = $state(false);

  /**
   * Signs in with the entered credentials.
   *
   * @param event The form submission.
   */
  async function submit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    failure = await session.signIn(username, password);
    busy = false;
    if (failure === null) {
      await navigate(session.takeReturnTo() ?? '/library/albums');
    }
  }
</script>

<svelte:head>
  <title>Sign in - Hearthsound</title>
</svelte:head>

<section class="login">
  <h1>Sign in</h1>

  <form class="login-form" onsubmit={submit}>
    <label class="login-field">
      <span>Username</span>
      <input name="username" autocomplete="username" bind:value={username} />
    </label>

    <label class="login-field">
      <span>Password</span>
      <input
        name="password"
        type="password"
        autocomplete="current-password"
        bind:value={password}
      />
    </label>

    {#if failure !== null}
      <p class="login-failure" role="alert">{failure}</p>
    {/if}

    <button class="login-submit" type="submit" disabled={busy}>Sign in</button>
  </form>
</section>

<style>
  .login {
    max-width: 22rem;
    margin: 0 auto;
  }

  .login-form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .login-field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .login-field input {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .login-failure {
    margin: 0;
    color: var(--color-danger);
  }

  .login-submit {
    padding: var(--space-2) var(--space-4);
    color: var(--color-accent-fg);
    font: inherit;
    background: var(--color-accent);
    border: none;
    border-radius: var(--radius);
    cursor: pointer;
  }

  .login-submit:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
