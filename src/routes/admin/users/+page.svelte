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
  import { deleteUser, listUsers, setUserDisabled } from '#lib/admin/api/users';
  import { isDisabled, userSummary } from '#lib/admin/users';
  import type { AdminUser } from '#lib/admin/users';
  import { PagedList } from '#lib/paging.svelte';
  import type { Page } from '#lib/paging.svelte';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { session } from '#lib/stores/session.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Avatar from '#lib/ui/Avatar.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import EndlessLoader from '#lib/ui/EndlessLoader.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';

  /** How many accounts one page holds. */
  const PAGE_SIZE = 60;

  const shell = getShellNavigation();

  /** The accounts read so far, one server page at a time. */
  const users = new PagedList<AdminUser, string>((user) => user.id);

  let creating = $state(false);
  let editing = $state<AdminUser | null>(null);
  let deleting = $state<AdminUser | null>(null);
  let deletingBusy = $state(false);

  onMount(() => {
    users.start(loadPage);
  });

  /**
   * Reads one page of accounts for the list.
   *
   * @param cursor The cursor of the page to read, or `null` for the first one.
   * @returns The page.
   */
  async function loadPage(cursor: string | null): Promise<Page<AdminUser, string>> {
    const result = await listUsers(cursor, PAGE_SIZE);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.value;
  }

  /**
   * Adds an account the server just created.
   *
   * @param user The account.
   */
  function created(user: AdminUser): void {
    creating = false;
    users.items = [...users.items, user].sort((left, right) =>
      left.username.localeCompare(right.username)
    );
  }

  /**
   * Replaces an account the server just changed.
   *
   * @param user The account as it is now.
   */
  function saved(user: AdminUser): void {
    editing = null;
    users.items = users.items.map((existing) => (existing.id === user.id ? user : existing));
  }

  /**
   * Deletes the account the confirmation shows.
   */
  async function remove(): Promise<void> {
    const user = deleting;
    if (user === null) {
      return;
    }
    deletingBusy = true;
    const result = await deleteUser(user.id);
    deletingBusy = false;
    if (!result.ok) {
      toasts.push(result.message, 'error');
      return;
    }
    users.items = users.items.filter((existing) => existing.id !== user.id);
    deleting = null;
    toasts.push(`Deleted ${user.displayName}.`);
  }

  /**
   * Disables or enables one account.
   *
   * @param user The account to switch.
   */
  async function toggle(user: AdminUser): Promise<void> {
    const result = await setUserDisabled(user.id, !isDisabled(user));
    if (!result.ok) {
      toasts.push(result.message, 'error');
      return;
    }
    users.items = users.items.map((existing) =>
      existing.id === result.value.id ? result.value : existing
    );
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
  {#if users.failure !== null}
    <p class="failure" role="alert">{users.failure}</p>
  {/if}

  {#if users.items.length === 0 && !users.loading && users.failure === null}
    <p class="empty">No accounts yet.</p>
  {:else if users.items.length > 0 || users.loading}
    <EndlessLoader
      onmore={() => void users.loadMore()}
      busy={users.loading}
      done={users.done || users.failure !== null}
    >
      <ul class="hs-settings-group rows" aria-label="Accounts">
        {#each users.items as user (user.id)}
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
              {#if user.id !== session.user?.id}
                <MenuItem
                  label="Delete User"
                  icon="adwaita-delete"
                  destructive
                  onselect={() => (deleting = user)}
                />
              {/if}
            </Menu>
          </li>
        {/each}

        {#if users.loading}
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

{#if deleting !== null}
  <Dialog
    title="Delete User?"
    alert
    onclose={() => (deleting = null)}
    description={`${deleting.displayName} and everything only their account owned are deleted. The files on disk stay.`}
  >
    <span aria-hidden="true"></span>

    {#snippet footer()}
      <Button disabled={deletingBusy} onclick={() => (deleting = null)}>Cancel</Button>
      <Button
        variant="destructive"
        busy={deletingBusy}
        disabled={deletingBusy}
        onclick={() => void remove()}
      >
        Delete User
      </Button>
    {/snippet}
  </Dialog>
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
