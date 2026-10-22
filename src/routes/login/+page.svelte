<!--
  The sign-in form.

  The split onboarding frame centres the brand lockup in a 40% panel on
  desktop and tablet, and collapses to the plain frame on phones (l12-r1). The
  password field takes the invalid tint and the k32 error line on failure, and
  the suggested button replaces its label with the k09 spinner while the sign-in
  runs (p01, busy-rule).

  A successful sign-in returns the browser to the route it was on when it was
  sent here, or to Home.
-->
<script lang="ts">
  import { tick } from 'svelte';

  import { navigate } from '#lib/navigation';
  import { session } from '#lib/stores/session.svelte';
  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import Lockup from '#lib/ui/Lockup.svelte';
  import TextField from '#lib/ui/TextField.svelte';

  const uid = $props.id();
  const usernameId = $derived(`signin-username-${uid}`);
  const passwordId = $derived(`signin-password-${uid}`);

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
      await navigate(session.takeReturnTo() ?? '/');
      return;
    }
    await tick();
    document.getElementById(passwordId)?.focus();
  }
</script>

<svelte:head>
  <title>Sign in - Hearthsound</title>
</svelte:head>

<div class="hs-onboarding hs-onboarding--split">
  <div class="hs-onboarding__brand">
    <Lockup large />
  </div>

  <div class="hs-onboarding__main">
    <form class="hs-signin" onsubmit={submit}>
      {#if session.expired}
        <Banner
          level="warning"
          role="alert"
          text="Your session ended. Sign in again to continue."
        />
      {/if}

      <h1 class="hs-title-2 title">Sign in</h1>

      <FormField label="Username" for={usernameId}>
        <TextField
          id={usernameId}
          name="username"
          autocomplete="username"
          bind:value={username}
          required
        />
      </FormField>

      <FormField label="Password" for={passwordId} error={failure ?? undefined}>
        <TextField
          id={passwordId}
          name="password"
          kind="password"
          autocomplete="current-password"
          bind:value={password}
          invalid={failure !== null}
          aria-describedby={failure === null ? undefined : `${passwordId}-error`}
          required
        />
      </FormField>

      <Button variant="suggested" type="submit" {busy}>Sign in</Button>
    </form>
  </div>
</div>

<style>
  .title {
    margin: 0;
  }
</style>
