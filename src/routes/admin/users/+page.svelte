<!--
  The accounts of the server (p22 C, k28, k34).

  One grey group lists the accounts in the order the server answers them; a row
  shows the avatar, the display name, the summary line and, when the account
  cannot sign in, its Disabled pill. The row menu edits the account or switches
  it off and on again, and the next page arrives as the end of the list comes
  into view. The dialog beside the list creates one account and changes one.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import UserDialog from '#lib/admin/UserDialog.svelte';
  import { problemMessage } from '#lib/admin/problem';
  import { isDisabled, userSummary } from '#lib/admin/users';
  import type { AdminUser } from '#lib/admin/users';
  import { nativeClient } from '#lib/api/native';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Avatar from '#lib/ui/Avatar.svelte';
  import Button from '#lib/ui/Button.svelte';
  import EndlessLoader from '#lib/ui/EndlessLoader.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';

  /** How many accounts one page holds. */
  const PAGE_SIZE = 60;

  const shell = getShellNavigation();

  let users = $state<AdminUser[]>([]);
  let nextCursor = $state<string | null>(null);
  let failure = $state<string | null>(null);
  let loading = $state(false);
  let creating = $state(false);
  let editing = $state<AdminUser | null>(null);

  const done = $derived(nextCursor === null || failure !== null);

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
    const answer = await nativeClient.PATCH('/api/v1/admin/users/{id}', {
      params: { path: { id: user.id } },
      body: { disabled: !isDisabled(user) }
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

{#snippet actions()}
  <Button
    variant="suggested"
    header
    icon="adwaita-add"
    label="Create User"
    onclick={() => (creating = true)}
  >
    Create User
  </Button>
{/snippet}

<PageHeader title="Users" class="admin-header" onnavigation={shell?.openNavigation} {actions} />

<div class="content">
  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  {#if users.length === 0 && !loading && failure === null}
    <p class="empty">No accounts yet.</p>
  {:else if users.length > 0 || loading}
    <EndlessLoader onmore={() => void load(nextCursor)} busy={loading} {done}>
      <ul class="hs-settings-group rows" aria-label="Accounts">
        {#each users as user (user.id)}
          {@const disabled = isDisabled(user)}
          <li class="hs-setting-row hs-setting-row--two-line">
            <Avatar />
            <span class="hs-setting-row__text">
              <span>{user.displayName}</span>
              <span class="hs-setting-row__subtitle summary">{userSummary(user)}</span>
            </span>
            {#if disabled}
              <span class="badge">
                <Pill tone="neutral" glyph="adwaita-remove" label="Disabled" />
              </span>
            {/if}
            <Menu label="More Actions" align="end">
              <MenuItem label="Edit" icon="adwaita-edit" onselect={() => (editing = user)} />
              <MenuItem
                label={disabled ? 'Enable' : 'Disable'}
                icon={disabled ? 'adwaita-check' : 'adwaita-remove'}
                onselect={() => void toggle(user)}
              />
            </Menu>
          </li>
        {/each}

        {#if loading}
          {#each [0, 1, 2] as row (row)}
            <li class="hs-setting-row" aria-hidden="true">
              <Skeleton width="32px" height="32px" radius="full" />
              <span class="hs-setting-row__text">
                <Skeleton width="40%" height="12px" />
                <Skeleton width="70%" height="10px" />
              </span>
            </li>
          {/each}
        {/if}
      </ul>
    </EndlessLoader>
  {/if}
</div>

{#if creating}
  <UserDialog user={null} onclose={() => (creating = false)} onsaved={created} />
{/if}

{#if editing !== null}
  <UserDialog user={editing} onclose={() => (editing = null)} onsaved={saved} />
{/if}

<style>
  /* Layout glue only: the shell already holds the page off the window edge, so
     the k25 header aligns to that margin. The class lands on the component's
     own header, hence `:global`. */
  :global(.admin-header) {
    padding-inline: 0;
  }

  /* Layout glue only: p22 puts the group directly under the header and leaves
     the page 28 px at the bottom. */
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    padding-block: 0 var(--hs-space-7);
  }

  /* Layout glue only: the group clips its overflow to round its corners, which
     would cut off a row's menu popover. */
  .rows {
    max-width: 760px;
    overflow: visible;
  }

  /* p22 ellipsises the summary line; the row's text column already shrinks. */
  .summary {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .badge {
    display: inline-flex;
    flex: none;
  }

  /* The muted empty line of p22; the package has no page-text empty class. */
  .empty {
    margin: 0;
    color: var(--hs-fg-muted);
  }

  .failure {
    margin: 0;
    color: var(--hs-error);
  }
</style>
