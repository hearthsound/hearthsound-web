<!--
  The acquisitions of every user (p26b B, k28, k10, k34).

  The ledger is split into the rows that still hold work, under Active, and the
  rows that ended, under Recent; there is no filter control. A row shows the
  track with its state pill beside it, the muted artist, priority, instance and
  time line, and a failure's reason, and its menu cancels running work or
  retries a row that ended without a file. Recent loads the next page as its
  end comes into view, and hides itself while it holds nothing. An update from
  the event stream moves the row between the groups as its state changes.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import {
    acquisitionIsActive,
    acquisitionPill,
    acquisitionProgress,
    acquisitionSummary,
    canCancel,
    canRetry,
    timeText
  } from '#lib/admin/acquisitions';
  import type { AcquisitionView } from '#lib/admin/acquisitions';
  import { problemMessage } from '#lib/admin/problem';
  import { nativeClient } from '#lib/api/native';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { events } from '#lib/stores/events.svelte';
  import type { AcquisitionUpdatedPayload } from '#lib/stores/events.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';
  import EndlessLoader from '#lib/ui/EndlessLoader.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import Button from '#lib/ui/Button.svelte';

  /** How many rows one page holds. */
  const PAGE_SIZE = 60;

  const shell = getShellNavigation();

  let active = $state<AcquisitionView[]>([]);
  let recent = $state<AcquisitionView[]>([]);
  let recentCursor = $state<string | null>(null);
  let activeLoading = $state(true);
  let recentLoading = $state(true);
  let failed = $state(false);
  let announcement = $state('');

  const recentDone = $derived(recentCursor === null);

  onMount(() => {
    void refresh();
    return events.on('acquisition.updated', (event) => applyUpdate(event.data, event.at));
  });

  /** Loads the first page of both groups again. */
  async function refresh(): Promise<void> {
    failed = false;
    active = [];
    recent = [];
    recentCursor = null;
    await Promise.all([loadActive(), loadRecent(null)]);
  }

  /** Loads the rows that still hold work. */
  async function loadActive(): Promise<void> {
    activeLoading = true;
    const answer = await nativeClient.GET('/api/v1/admin/acquisitions', {
      params: { query: { state: 'active', limit: PAGE_SIZE } }
    });
    activeLoading = false;
    if (answer.data === undefined) {
      failed = true;
      return;
    }
    active = answer.data.acquisitions;
  }

  /**
   * Loads one page of the rows that ended.
   *
   * @param cursor The cursor of the page to load, or `null` for the first one.
   */
  async function loadRecent(cursor: string | null): Promise<void> {
    recentLoading = true;
    const answer = await nativeClient.GET('/api/v1/admin/acquisitions', {
      params: {
        query:
          cursor === null
            ? { state: 'recent', limit: PAGE_SIZE }
            : { state: 'recent', limit: PAGE_SIZE, cursor }
      }
    });
    recentLoading = false;
    if (answer.data === undefined) {
      failed = true;
      return;
    }
    const page = answer.data.acquisitions;
    recent = cursor === null ? page : merge(recent, page);
    recentCursor = answer.data.nextCursor ?? null;
  }

  /**
   * Joins a page of rows to the ones already loaded, once per id.
   *
   * A row the event stream moved to the head of the group may also arrive in a
   * later page, and a keyed list cannot hold it twice.
   *
   * @param rows The rows already shown.
   * @param page The rows of the new page.
   * @returns The rows in order, without a duplicate id.
   */
  function merge(rows: AcquisitionView[], page: AcquisitionView[]): AcquisitionView[] {
    const seen = rows.map((row) => row.id);
    const added = page.filter((row) => {
      if (seen.includes(row.id)) {
        return false;
      }
      seen.push(row.id);
      return true;
    });
    return [...rows, ...added];
  }

  /**
   * Applies one update from the event stream to the group its row belongs to.
   *
   * @param update The acquisition the server reported.
   * @param at When the server published the update, in unix milliseconds.
   */
  function applyUpdate(update: AcquisitionUpdatedPayload, at: number): void {
    const known =
      active.find((row) => row.id === update.acquisitionId) ??
      recent.find((row) => row.id === update.acquisitionId);
    if (known === undefined) {
      return;
    }
    const stateActive = acquisitionIsActive({ ...known, state: update.state });
    const merged: AcquisitionView = {
      ...known,
      state: update.state,
      percent: update.percent ?? (update.state === 'downloading' ? (known.percent ?? null) : null),
      priority: update.priority,
      instance: update.instance ?? known.instance,
      failureReason: stateActive ? null : (update.failureReason ?? known.failureReason),
      updatedAt: at
    };
    announcement = `${merged.trackTitle ?? 'Unknown track'}: ${acquisitionProgress(merged)}`;

    if (stateActive) {
      active = [merged, ...active.filter((row) => row.id !== merged.id)];
      recent = recent.filter((row) => row.id !== merged.id);
    } else {
      recent = [merged, ...recent.filter((row) => row.id !== merged.id)];
      active = active.filter((row) => row.id !== merged.id);
    }
  }

  /**
   * Cancels one acquisition that still holds work.
   *
   * @param row The acquisition to cancel.
   */
  async function cancel(row: AcquisitionView): Promise<void> {
    const answer = await nativeClient.POST('/api/v1/admin/acquisitions/{id}/cancel', {
      params: { path: { id: row.id } }
    });
    if (answer.response.status !== 204) {
      toasts.push(problemMessage(answer.error, 'Could not cancel the acquisition.'), 'error');
      return;
    }
    await refresh();
  }

  /**
   * Starts a new attempt for one acquisition that ended without a file.
   *
   * @param row The acquisition to retry.
   */
  async function retry(row: AcquisitionView): Promise<void> {
    const answer = await nativeClient.POST('/api/v1/admin/acquisitions/{id}/retry', {
      params: { path: { id: row.id } }
    });
    if (answer.data === undefined) {
      toasts.push(problemMessage(answer.error, 'Could not retry the acquisition.'), 'error');
      return;
    }
    toasts.push(`The retry was ${answer.data.outcome}.`);
    await refresh();
  }
</script>

<svelte:head>
  <title>Acquisitions - Hearthsound</title>
</svelte:head>

{#snippet rowContent(row: AcquisitionView)}
  {@const pill = acquisitionPill(row)}
  <span class="hs-setting-row__text">
    <span class="title">
      <span>{row.trackTitle ?? 'Unknown track'}</span>
      <Pill tone={pill.tone} glyph={pill.glyph} label={pill.label} />
    </span>
    <span class="hs-setting-row__subtitle summary">
      {acquisitionSummary(row, timeText(row.updatedAt))}
    </span>
    {#if row.failureReason !== null && row.failureReason !== undefined}
      <span class="hs-setting-row__subtitle hs-setting-row__subtitle--error">
        {row.failureReason}
      </span>
    {/if}
  </span>
  {#if canCancel(row) || canRetry(row)}
    <Menu label="More Actions" align="end">
      {#if canCancel(row)}
        <MenuItem label="Cancel" icon="adwaita-close" onselect={() => void cancel(row)} />
      {/if}
      {#if canRetry(row)}
        <MenuItem label="Retry" icon="adwaita-refresh" onselect={() => void retry(row)} />
      {/if}
    </Menu>
  {/if}
{/snippet}

{#snippet placeholderRows()}
  {#each [0, 1, 2] as row (row)}
    <li class="hs-setting-row hs-setting-row--acquisition" aria-hidden="true">
      <span class="hs-setting-row__text">
        <Skeleton width="30%" height="14px" />
        <Skeleton width="55%" height="11px" />
      </span>
    </li>
  {/each}
{/snippet}

{#snippet retryAction()}
  <Button onclick={() => void refresh()}>Retry</Button>
{/snippet}

<PageHeader title="Acquisitions" class="admin-header" onnavigation={shell?.openNavigation} />

<div class="content">
  {#if failed}
    <StatusPage
      level={2}
      alert
      icon="adwaita-error"
      title="Could Not Load This Page"
      text="The server did not answer. Try again in a moment."
      action={retryAction}
    />
  {:else}
    <section class="group-block">
      <h2 class="hs-section-header__title group-heading">Active</h2>

      {#if active.length === 0 && !activeLoading}
        <p class="empty">Nothing is acquiring.</p>
      {:else}
        <ul class="hs-settings-group rows" aria-label="Active acquisitions">
          {#each active as row (row.id)}
            <li class="hs-setting-row hs-setting-row--acquisition">
              {@render rowContent(row)}
            </li>
          {/each}
          {#if activeLoading}
            {@render placeholderRows()}
          {/if}
        </ul>
      {/if}
    </section>

    {#if recent.length > 0 || recentLoading}
      <section class="group-block">
        <h2 class="hs-section-header__title group-heading">Recent</h2>

        <EndlessLoader
          onmore={() => void loadRecent(recentCursor)}
          busy={recentLoading}
          done={recentDone}
        >
          <ul class="hs-settings-group rows" aria-label="Recent acquisitions">
            {#each recent as row (row.id)}
              <li class="hs-setting-row hs-setting-row--acquisition">
                {@render rowContent(row)}
              </li>
            {/each}
            {#if recentLoading}
              {@render placeholderRows()}
            {/if}
          </ul>
        </EndlessLoader>
      </section>
    {/if}
  {/if}
</div>

<span class="hs-visually-hidden" role="status">{announcement}</span>

<style>
  /* Layout glue only: the shell already holds the page off the window edge, so
     the k25 header aligns to that margin. The class lands on the component's
     own header, hence `:global`. */
  :global(.admin-header) {
    padding-inline: 0;
  }

  /* Layout glue only: p26b stacks the groups under the header and leaves the
     page 28 px at the bottom. */
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    padding-block: 0 var(--hs-space-7);
  }

  .group-block {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Layout glue only: the boards put the group 10 px under its heading and the
     heading 10 px below the gap above it. The package carries the 19/750 type
     on `hs-section-header__title` and no page-group heading class. */
  .group-heading {
    margin: 10px 0 0;
  }

  /* Layout glue only: the group clips its overflow to round its corners, which
     would cut off a row's menu popover. p26b caps every group at 760 px. */
  .rows {
    max-width: 760px;
    overflow: visible;
  }

  /* The track and its pill share the row's title line (p26b). */
  .title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--hs-space-2);
  }

  /* p26b keeps the summary on one line on deskop and lets it wrap on phones,
     which the package's acquisition row already does. */
  .summary {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* The muted empty line of p26b, under Active; the package has no page-text
     empty class. */
  .empty {
    margin: 0;
    color: var(--hs-fg-muted);
  }
</style>
