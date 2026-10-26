<!--
  The account page (E-B-1, E-B-2, decision 21).

  Opened from the account menu. Three groups: the account's own password, the
  API keys and the app passwords that let other clients sign in. Each credential
  group lists what exists with the moment it was created and last used, creates
  one under a name, shows the secret exactly once and revokes behind a
  confirmation.

  The page owns the two credential reads; the Save Location group that decision
  21 puts last mounts here too once the server reports the folders an account
  owns (`GET /api/v1/me/folders`), and renders nothing for an account without
  one. A failed read shows the retry page rather than an empty list, because an
  empty list would claim there are no credentials.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import {
    createdText,
    credentialLabels,
    lastUsedText,
    listApiKeys,
    listAppPasswords,
    revokeApiKey,
    revokeAppPassword
  } from '#lib/account/credentials';
  import type { ApiKeyView, AppPasswordView, CredentialKind } from '#lib/account/credentials';
  import { goBack } from '#lib/navigation';
  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  import CredentialDialog from './CredentialDialog.svelte';
  import PasswordForm from './PasswordForm.svelte';
  import SecretDialog from './SecretDialog.svelte';

  /** The credential a confirmation dialog asks about. */
  interface Revoking {
    /** Which list the credential belongs to. */
    kind: CredentialKind;
    /** The credential's client id. */
    id: string;
    /** The name the dialog and the sentence use. */
    name: string;
  }

  /** The one-time secret a created credential answered with. */
  interface Revealing {
    /** The title of the dialog, which names the kind. */
    title: string;
    /** The secret itself. */
    secret: string;
  }

  let keys = $state<ApiKeyView[]>([]);
  let passwords = $state<AppPasswordView[]>([]);
  let loading = $state(true);
  let failure = $state<string | null>(null);
  /** The kind of credential the entry dialog creates, when it is open. */
  let creating = $state<CredentialKind | null>(null);
  /** The secret the last created credential answered with, when it is shown. */
  let revealing = $state<Revealing | null>(null);
  /** The credential the confirmation dialog asks about, when it is open. */
  let revoking = $state<Revoking | null>(null);
  /** The problem a refused revoke answered with, shown inside its dialog. */
  let revokeFailure = $state<string | null>(null);
  /** Whether the revoke the confirmation dialog asked for is running. */
  let revokeBusy = $state(false);

  onMount(() => {
    void load();
  });

  /** Reads both credential lists. */
  async function load(): Promise<void> {
    loading = keys.length === 0 && passwords.length === 0 && failure === null;
    const [keyResult, passwordResult] = await Promise.all([listApiKeys(), listAppPasswords()]);
    loading = false;
    if (!keyResult.ok) {
      failure = keyResult.message;
      return;
    }
    if (!passwordResult.ok) {
      failure = passwordResult.message;
      return;
    }
    failure = null;
    keys = keyResult.value;
    passwords = passwordResult.value;
  }

  /** Asks the server again after a failed read. */
  function retry(): void {
    void load();
  }

  /**
   * Shows the secret a credential was created with, and closes the entry dialog.
   *
   * @param created The name and secret the server answered with.
   */
  function created(created: { name: string; secret: string }): void {
    const kind = creating;
    creating = null;
    revealing = {
      title: credentialLabels(kind ?? 'apiKey').created,
      secret: created.secret
    };
  }

  /** Closes the secret and reloads the lists, so the new row appears. */
  function secretClosed(): void {
    revealing = null;
    void load();
  }

  /**
   * Opens the confirmation for one credential.
   *
   * @param kind Which list the credential belongs to.
   * @param entry The credential row.
   */
  function askRevoke(kind: CredentialKind, entry: ApiKeyView | AppPasswordView): void {
    revokeFailure = null;
    revoking = { kind, id: entry.id, name: entry.name };
  }

  /** Revokes the credential the confirmation dialog asked about. */
  async function revoke(): Promise<void> {
    const target = revoking;
    if (target === null) {
      return;
    }
    revokeBusy = true;
    const result =
      target.kind === 'apiKey' ? await revokeApiKey(target.id) : await revokeAppPassword(target.id);
    revokeBusy = false;
    if (!result.ok) {
      revokeFailure = result.message;
      return;
    }
    if (target.kind === 'apiKey') {
      keys = keys.filter((key) => key.id !== target.id);
    } else {
      passwords = passwords.filter((password) => password.id !== target.id);
    }
    revoking = null;
  }

  /** Returns to the page that opened this one. */
  function back(): void {
    goBack('/');
  }

  /**
   * Names the title of the confirmation dialog.
   *
   * @param target The credential the dialog asks about.
   * @returns The title.
   */
  function revokeTitle(target: Revoking): string {
    return target.kind === 'apiKey' ? 'Revoke This API Key?' : 'Revoke This App Password?';
  }
</script>

<svelte:head>
  <title>Account - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={retry}>Retry</Button>
{/snippet}

{#snippet credentialPlaceholders()}
  <div class="hs-settings-group group" aria-busy="true">
    <span class="hs-visually-hidden" role="status">Loading...</span>
    {#each [0, 1] as row (row)}
      <div class="hs-setting-row hs-setting-row--two-line" aria-hidden="true">
        <span class="hs-setting-row__text">
          <Skeleton width="30%" height="12px" />
          <Skeleton width="55%" height="10px" />
        </span>
      </div>
    {/each}
  </div>
{/snippet}

<PageHeader title="Account" class="account-header" onback={back} />

<div class="content">
  {#if failure !== null}
    <div class="state">
      <StatusPage
        level={2}
        alert
        icon="adwaita-error"
        title="Could Not Load This Page"
        text="The server did not answer. Try again in a moment."
        action={retryAction}
      />
    </div>
  {:else}
    <section class="account-group" aria-label="Password">
      <h2 class="hs-title-4">Password</h2>
      <p class="group-note">
        Changing the password signs out your other devices and stops every API key and app password.
      </p>
      <div class="hs-settings-group group">
        <div class="form-panel">
          <PasswordForm />
        </div>
      </div>
    </section>

    <section class="account-group" aria-label="API Keys">
      <h2 class="hs-title-4">API Keys</h2>
      <p class="group-note">
        Use an API key as a Bearer token, or as <code class="hs-inline-code">apiKey=</code> on the Subsonic
        API.
      </p>
      <div class="group-command">
        <Button icon="adwaita-add" onclick={() => (creating = 'apiKey')}>Create API Key</Button>
      </div>
      {#if loading && keys.length === 0}
        {@render credentialPlaceholders()}
      {:else if keys.length === 0}
        <p class="empty">No API keys yet</p>
      {:else}
        <div class="hs-settings-group group">
          {#each keys as key (key.id)}
            <div class="hs-setting-row hs-setting-row--two-line">
              <span class="hs-setting-row__text">
                <span class="title">{key.name}</span>
                <span class="hs-setting-row__subtitle">Starts with {key.prefix}</span>
                <span class="hs-setting-row__subtitle">{createdText(key.createdAt)}</span>
                <span class="hs-setting-row__subtitle">{lastUsedText(key.lastUsedAt)}</span>
              </span>
              <div class="actions">
                <Button variant="destructive" onclick={() => askRevoke('apiKey', key)}>
                  Revoke
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="account-group" aria-label="App Passwords">
      <h2 class="hs-title-4">App Passwords</h2>
      <p class="group-note">
        Subsonic apps sign in with an app password instead of your account password.
        <a
          class="hs-link"
          href="https://hearthsound.app/docs/clients/app-passwords"
          target="_blank"
          rel="noreferrer">Read about app passwords</a
        >
      </p>
      <div class="group-command">
        <Button icon="adwaita-add" onclick={() => (creating = 'appPassword')}>
          Create App Password
        </Button>
      </div>
      {#if loading && passwords.length === 0}
        {@render credentialPlaceholders()}
      {:else if passwords.length === 0}
        <p class="empty">No app passwords yet</p>
      {:else}
        <div class="hs-settings-group group">
          {#each passwords as password (password.id)}
            <div class="hs-setting-row hs-setting-row--two-line">
              <span class="hs-setting-row__text">
                <span class="title">{password.name}</span>
                <span class="hs-setting-row__subtitle">{createdText(password.createdAt)}</span>
                <span class="hs-setting-row__subtitle">{lastUsedText(password.lastUsedAt)}</span>
              </span>
              <div class="actions">
                <Button variant="destructive" onclick={() => askRevoke('appPassword', password)}>
                  Revoke
                </Button>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</div>

{#if creating !== null}
  {@const kind = creating}
  <CredentialDialog {kind} onclose={() => (creating = null)} oncreated={created} />
{/if}

{#if revealing !== null}
  {@const shown = revealing}
  <SecretDialog title={shown.title} secret={shown.secret} onclose={secretClosed} />
{/if}

{#if revoking !== null}
  {@const target = revoking}
  <Dialog
    title={revokeTitle(target)}
    alert
    onclose={() => (revoking = null)}
    description="Anything using it stops working immediately."
  >
    {#if revokeFailure !== null}
      <Banner level="error" text={revokeFailure} />
    {:else}
      <span aria-hidden="true"></span>
    {/if}

    {#snippet footer()}
      <Button disabled={revokeBusy} onclick={() => (revoking = null)}>Cancel</Button>
      <Button
        variant="destructive"
        busy={revokeBusy}
        disabled={revokeBusy}
        onclick={() => void revoke()}
      >
        Revoke
      </Button>
    {/snippet}
  </Dialog>
{/if}

<style>
  /* Layout glue only: the shell holds the page off the window edge. */
  :global(.account-header) {
    padding-inline: 0;
  }

  /* Layout glue only: the groups sit under the header and the page keeps its
     bottom margin. */
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-6);
    padding-block: 0 var(--hs-space-7);
  }

  .account-group {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-2);
  }

  /* Layout glue only: a group clips its overflow to round its corners, which
     would cut off the password form's focus ring. */
  .group {
    max-width: 760px;
    overflow: visible;
  }

  .group-note {
    margin: 0;
    color: var(--hs-fg-muted);
    font: 400 13px/1.5 var(--hs-font-body);
  }

  .group-command {
    display: flex;
  }

  /* Layout glue only: k18 puts every field 18 px apart, and the form needs the
     group's inner padding to line up with a row's text. */
  .form-panel {
    padding: var(--hs-space-4);
  }

  .title {
    font-weight: 600;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .empty {
    margin: 0;
    color: var(--hs-fg-muted);
    font: 400 14px/1.4 var(--hs-font-body);
  }

  .state {
    padding: var(--hs-space-7) 0;
  }
</style>
