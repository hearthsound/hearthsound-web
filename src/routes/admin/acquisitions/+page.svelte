<!--
  The acquisitions of every user.

  The ledger is filtered by whether a row still holds work; a row shows what it
  is acquiring, how far it has come and which instance is doing it. An update
  from the event stream is applied to the row it names, so the table follows the
  server while it polls, and a row can be cancelled while it holds work or
  retried once it ended without a file.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import {
    ACQUISITION_FILTERS,
    acquisitionProgress,
    canCancel,
    canRetry,
    filterAcquisitions
  } from '#lib/admin/acquisitions';
  import type { AcquisitionFilter, AcquisitionView } from '#lib/admin/acquisitions';
  import { problemMessage } from '#lib/admin/problem';
  import { nativeClient } from '#lib/api/native';
  import { events } from '#lib/stores/events.svelte';
  import type { AcquisitionUpdatedPayload } from '#lib/stores/events.svelte';
  import { toasts } from '#lib/stores/toasts.svelte';

  /** How many rows one page holds. */
  const PAGE_SIZE = 60;

  let filter = $state<AcquisitionFilter>('active');
  let rows = $state<AcquisitionView[]>([]);
  let nextCursor = $state<string | null>(null);
  let failure = $state<string | null>(null);

  onMount(() => {
    void load(null);
    return events.on('acquisition.updated', (event) => applyUpdate(event.data, event.at));
  });

  /**
   * Loads one page of the ledger.
   *
   * @param cursor The cursor of the page to load, or `null` for the first one.
   */
  async function load(cursor: string | null): Promise<void> {
    const query: { state: string; limit: number; cursor?: string } =
      cursor === null
        ? { state: filter, limit: PAGE_SIZE }
        : { state: filter, limit: PAGE_SIZE, cursor };
    const answer = await nativeClient.GET('/api/v1/admin/acquisitions', { params: { query } });
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not load the acquisitions.');
      return;
    }
    failure = null;
    rows = cursor === null ? answer.data.acquisitions : [...rows, ...answer.data.acquisitions];
    nextCursor = answer.data.nextCursor ?? null;
  }

  /**
   * Changes the part of the ledger the table shows.
   *
   * @param event The change of the filter.
   */
  function chooseFilter(event: Event): void {
    const chosen = (event.currentTarget as HTMLSelectElement).value;
    filter = ACQUISITION_FILTERS.find((offered) => offered === chosen) ?? filter;
    void load(null);
  }

  /**
   * Applies one update from the event stream to the row it names.
   *
   * @param update The acquisition the server reported.
   * @param at When the server published the update, in unix milliseconds.
   */
  function applyUpdate(update: AcquisitionUpdatedPayload, at: number): void {
    const known = rows.find((row) => row.id === update.acquisitionId);
    if (known === undefined) {
      return;
    }
    const merged: AcquisitionView = {
      ...known,
      state: update.state,
      percent: update.percent ?? known.percent,
      priority: update.priority,
      instance: update.instance ?? known.instance,
      failureReason: update.failureReason ?? known.failureReason,
      updatedAt: at
    };
    rows = filterAcquisitions(
      rows.map((row) => (row.id === merged.id ? merged : row)),
      filter
    );
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
    await load(null);
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
    await load(null);
  }
</script>

<svelte:head>
  <title>Acquisitions - Hearthsound</title>
</svelte:head>

<section class="page">
  <header class="header">
    <h1>Acquisitions</h1>
    <label class="filter">
      <span class="field-label">Show</span>
      <select class="input" value={filter} onchange={chooseFilter}>
        {#each ACQUISITION_FILTERS as offered (offered)}
          <option value={offered}>{offered}</option>
        {/each}
      </select>
    </label>
  </header>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  <table class="table">
    <thead>
      <tr>
        <th scope="col">Track</th>
        <th scope="col">Progress</th>
        <th scope="col">Priority</th>
        <th scope="col">Instance</th>
        <th scope="col">Updated</th>
        <th scope="col"><span class="visually-hidden">Commands</span></th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.id)}
        <tr>
          <td>
            <span class="name">{row.trackTitle ?? 'Unknown track'}</span>
            {#if row.trackArtist !== null && row.trackArtist !== undefined}
              <span class="detail">{row.trackArtist}</span>
            {/if}
            {#if row.failureReason !== null && row.failureReason !== undefined}
              <span class="detail">{row.failureReason}</span>
            {/if}
          </td>
          <td>{acquisitionProgress(row)}</td>
          <td>{row.priority}</td>
          <td>{row.instance ?? '-'}</td>
          <td>{new Date(row.updatedAt).toLocaleString()}</td>
          <td class="commands">
            {#if canCancel(row)}
              <button type="button" onclick={() => cancel(row)}>Cancel</button>
            {/if}
            {#if canRetry(row)}
              <button type="button" onclick={() => retry(row)}>Retry</button>
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if rows.length === 0 && failure === null}
    <p class="hint">Nothing is acquiring.</p>
  {/if}

  {#if nextCursor !== null}
    <button type="button" onclick={() => load(nextCursor)}>Load more</button>
  {/if}
</section>

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

  .filter {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .field-label {
    font-weight: 600;
  }

  .input {
    padding: var(--space-1) var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .table {
    width: 100%;
    border-collapse: collapse;
  }

  .table th,
  .table td {
    padding: var(--space-2);
    text-align: left;
    vertical-align: top;
    border-bottom: var(--border-width) solid var(--color-border);
  }

  .table th {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .name {
    display: block;
  }

  .detail {
    display: block;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .commands {
    display: flex;
    gap: var(--space-1);
    justify-content: flex-end;
  }

  .commands button,
  .page > button {
    padding: var(--space-1) var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .commands button:hover {
    color: var(--color-accent);
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
