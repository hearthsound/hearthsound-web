<!--
  The accounts of the server.

  The table pages through the accounts as the server answers them, and the
  dialogs beside it create one or change one, including the password, the
  administrator flag, the three permissions and the daily quota. Disabling an
  account keeps its data; enabling it lets it sign in again.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import UserDialog from '#lib/admin/UserDialog.svelte';
  import { problemMessage } from '#lib/admin/problem';
  import { permissionsText, quotaText } from '#lib/admin/users';
  import type { AdminUser } from '#lib/admin/users';
  import { nativeClient } from '#lib/api/native';
  import { toasts } from '#lib/stores/toasts.svelte';

  /** How many accounts one page holds. */
  const PAGE_SIZE = 60;

  let users = $state<AdminUser[]>([]);
  let nextCursor = $state<string | null>(null);
  let failure = $state<string | null>(null);
  let loading = $state(false);
  let creating = $state(false);
  let editing = $state<AdminUser | null>(null);

  onMount(() => {
    void load(null);
  });

  /**
   * Loads one page of accounts.
   *
   * @param cursor The cursor of the page to load, or `null` for the first one.
   */
  async function load(cursor: string | null): Promise<void> {
    loading = true;
    const answer = await nativeClient.GET('/api/v1/admin/users', {
      params: { query: cursor === null ? { limit: PAGE_SIZE } : { limit: PAGE_SIZE, cursor } }
    });
    loading = false;
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not load the accounts.');
      return;
    }
    failure = null;
    users = cursor === null ? answer.data.users : [...users, ...answer.data.users];
    nextCursor = answer.data.nextCursor ?? null;
  }

  /**
   * Adds an account the server just created.
   *
   * @param user The account.
   */
  function created(user: AdminUser): void {
    creating = false;
    users = [...users, user].sort((left, right) => left.username.localeCompare(right.username));
  }

  /**
   * Replaces an account the server just changed.
   *
   * @param user The account as it is now.
   */
  function saved(user: AdminUser): void {
    editing = null;
    users = users.map((existing) => (existing.id === user.id ? user : existing));
  }

  /**
   * Disables or enables one account.
   *
   * @param user The account to switch.
   */
  async function toggle(user: AdminUser): Promise<void> {
    const disabled = user.disabledAt === undefined || user.disabledAt === null;
    const answer = await nativeClient.PATCH('/api/v1/admin/users/{id}', {
      params: { path: { id: user.id } },
      body: { disabled }
    });
    const changed = answer.data;
    if (changed === undefined) {
      toasts.push(problemMessage(answer.error, 'Could not change the account.'), 'error');
      return;
    }
    users = users.map((existing) => (existing.id === changed.id ? changed : existing));
  }
</script>

<svelte:head>
  <title>Users - Hearthsound</title>
</svelte:head>

<section class="page">
  <header class="header">
    <h1>Users</h1>
    <button type="button" onclick={() => (creating = true)}>Create user</button>
  </header>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  <table class="table">
    <thead>
      <tr>
        <th scope="col">Username</th>
        <th scope="col">Display name</th>
        <th scope="col">Role</th>
        <th scope="col">Permissions</th>
        <th scope="col">Quota</th>
        <th scope="col">State</th>
        <th scope="col"><span class="visually-hidden">Commands</span></th>
      </tr>
    </thead>
    <tbody>
      {#each users as user (user.id)}
        <tr>
          <td>{user.username}</td>
          <td>{user.displayName}</td>
          <td>{user.isAdmin ? 'Administrator' : 'Member'}</td>
          <td>{permissionsText(user)}</td>
          <td>{quotaText(user)}</td>
          <td
            >{user.disabledAt === undefined || user.disabledAt === null ? 'Active' : 'Disabled'}</td
          >
          <td class="commands">
            <button type="button" onclick={() => (editing = user)}>Edit</button>
            <button type="button" onclick={() => toggle(user)}>
              {user.disabledAt === undefined || user.disabledAt === null ? 'Disable' : 'Enable'}
            </button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if users.length === 0 && failure === null}
    <p class="hint">No accounts yet.</p>
  {/if}

  {#if nextCursor !== null}
    <button type="button" onclick={() => load(nextCursor)} disabled={loading}>Load more</button>
  {/if}
</section>

{#if creating}
  <UserDialog user={null} onclose={() => (creating = false)} onsaved={created} />
{/if}

{#if editing !== null}
  <UserDialog user={editing} onclose={() => (editing = null)} onsaved={saved} />
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: baseline;
    justify-content: space-between;
  }

  .header h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .header button,
  .commands button {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .header button:hover,
  .commands button:hover {
    color: var(--color-accent);
  }

  .table {
    width: 100%;
    border-collapse: collapse;
  }

  .table th,
  .table td {
    padding: var(--space-2);
    text-align: left;
    border-bottom: var(--border-width) solid var(--color-border);
  }

  .table th {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .commands {
    display: flex;
    gap: var(--space-1);
    justify-content: flex-end;
  }

  .failure {
    margin: 0;
    color: var(--color-danger);
  }

  .hint {
    margin: 0;
    color: var(--color-fg-muted);
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
