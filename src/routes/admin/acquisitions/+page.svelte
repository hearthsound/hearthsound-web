<!--
  The acquisitions of every user (p26b B, k28, k10, k34).

  The ledger is split into the rows that still hold work, under Active, and the
  rows that ended, under Recent; there is no filter control. A row shows the
  track with its state pill beside it, the muted artist, priority, instance and
  time line, and a failure's reason, and its menu cancels running work or
  retries a row that ended without a file. Recent loads the next page as its
  end comes into view, and hides itself while it holds nothing. An update from
  the event stream moves the row between the groups as its state changes; one
  that names a row the page has not read yet reads the active list again, at most
  once per burst.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import {
    acquisitionFailureText,
    acquisitionPill,
    acquisitionSummary,
    acquisitionTargetKindLabel,
    acquisitionTargetTitle,
    canCancel,
    canRetry,
    mergeUpdate,
    timeText
  } from '#lib/admin/acquisitions';
  import type { AcquisitionView } from '#lib/admin/acquisitions';
  import {
    cancelAcquisition,
    listAcquisitions,
    retryAcquisition
  } from '#lib/admin/api/acquisitions';
  import { PagedList } from '#lib/paging.svelte';
  import type { Page } from '#lib/paging.svelte';
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

  /** The rows that still hold work; they are read whole, not paged. */
  let active = $state<AcquisitionView[]>([]);
  let activeLoading = $state(true);
  let activeFailed = $state(false);

  /** The rows that ended, one server page at a time. */
  const recent = new PagedList<AcquisitionView, string>((row) => row.id);

  let announcement = $state('');
  /** Whether the coalesced read of the active list is running. */
  let absorbing = $state(false);
  /** Whether an update arrived while that read was running. */
  let pendingAbsorb = false;

  const failed = $derived(activeFailed || recent.failure !== null);

  onMount(() => {
    void refresh();
    return events.on('acquisition.updated', (event) => applyUpdate(event.data, event.at));
  });

  /** Loads the first page of both groups again. */
  async function refresh(): Promise<void> {
    activeFailed = false;
    active = [];
    activeLoading = true;
    recent.start(loadRecentPage);
    await loadActive();
  }

  /** Loads the rows that still hold work. */
  async function loadActive(): Promise<void> {
    activeLoading = true;
    const result = await listAcquisitions('active', null, PAGE_SIZE);
    activeLoading = false;
    if (!result.ok) {
      activeFailed = true;
      return;
    }
    active = result.value.items;
  }

  /**
   * Reads one page of the rows that ended.
   *
   * @param cursor The cursor of the page to read, or `null` for the first one.
   * @returns The page.
   */
  async function loadRecentPage(cursor: string | null): Promise<Page<AcquisitionView, string>> {
    const result = await listAcquisitions('recent', cursor, PAGE_SIZE);
    if (!result.ok) {
      throw new Error(result.message);
    }
    return result.value;
  }

  /**
   * Applies one update from the event stream to the group its row belongs to.
   *
   * The creation frame names an id the page has never read, and the list is the
   * only route that carries a row's title, so an unknown id is answered by
   * reading the active list again.
   *
   * @param update The acquisition the server reported.
   * @param at When the server published the update, in unix milliseconds.
   */
  function applyUpdate(update: AcquisitionUpdatedPayload, at: number): void {
    const merged = mergeUpdate(update, at, active, recent.items);
    if (merged.unknown) {
      void absorbUnknown();
      return;
    }
    active = merged.active;
    recent.items = merged.recent;
    announcement = merged.announcement;
  }

  /**
   * Reads the active list again after an update named a row it did not hold.
   *
   * A burst of new ids costs one list read per completion, never one per event:
   * an update that arrives while the read runs asks for one more read once it
   * finishes.
   */
  async function absorbUnknown(): Promise<void> {
    if (absorbing) {
      pendingAbsorb = true;
      return;
    }
    absorbing = true;
    await loadActive();
    absorbing = false;
    if (pendingAbsorb) {
      pendingAbsorb = false;
      void absorbUnknown();
    }
  }

  /**
   * Cancels one acquisition that still holds work.
   *
   * @param row The acquisition to cancel.
   */
  async function cancel(row: AcquisitionView): Promise<void> {
    const result = await cancelAcquisition(row.id);
    if (!result.ok) {
      toasts.push(result.message, 'error');
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
    const result = await retryAcquisition(row.id);
    if (!result.ok) {
      toasts.push(result.message, 'error');
      return;
    }
    toasts.push(`The retry was ${result.value.outcome}.`);
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
      <span class="hs-visually-hidden">{acquisitionTargetKindLabel(row)}</span>
      <span>{acquisitionTargetTitle(row)}</span>
      <Pill tone={pill.tone} glyph={pill.glyph} label={pill.label} />
    </span>
    <span class="hs-setting-row__subtitle summary">
      {acquisitionSummary(row, timeText(row.updatedAt))}
    </span>
    {#if row.failureReason !== null && row.failureReason !== undefined}
      <span class="hs-setting-row__subtitle hs-setting-row__subtitle--error">
        {acquisitionFailureText(row)}
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

    {#if recent.items.length > 0 || recent.loading}
      <section class="group-block">
        <h2 class="hs-section-header__title group-heading">Recent</h2>

        <EndlessLoader
          onmore={() => void recent.loadMore()}
          busy={recent.loading}
          done={recent.done}
        >
          <ul class="hs-settings-group rows" aria-label="Recent acquisitions">
            {#each recent.items as row (row.id)}
              <li class="hs-setting-row hs-setting-row--acquisition">
                {@render rowContent(row)}
              </li>
            {/each}
            {#if recent.loading}
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
