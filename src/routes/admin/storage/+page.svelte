<!--
  The storage the server manages.

  The cards count what the cache and the library hold and what the filesystem
  under them still has; the form edits the policy that decides what is kept,
  evicted and demoted; and the pass runs the same maintenance the background
  worker runs.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import SettingField from '#lib/admin/SettingField.svelte';
  import { formatBytes } from '#lib/admin/bytes';
  import { problemMessage } from '#lib/admin/problem';
  import type { ServerSetting } from '#lib/admin/settings';
  import { maintenanceText, policySettings } from '#lib/admin/storage';
  import type { components } from '#lib/api/schema';
  import { nativeClient } from '#lib/api/native';
  import { toasts } from '#lib/stores/toasts.svelte';

  /** What the managed roots and the scanned folders hold. */
  type StorageReport = components['schemas']['StorageReport'];

  let report = $state<StorageReport | null>(null);
  let settings = $state<ServerSetting[]>([]);
  let failure = $state<string | null>(null);

  const policy = $derived(policySettings(settings));

  onMount(() => {
    void load();
  });

  /** Loads the usage and the settings the policy form edits. */
  async function load(): Promise<void> {
    const [usage, registered] = await Promise.all([
      nativeClient.GET('/api/v1/admin/storage'),
      nativeClient.GET('/api/v1/admin/settings')
    ]);
    if (usage.data === undefined) {
      failure = problemMessage(usage.error, 'Could not read the storage usage.');
      return;
    }
    failure = null;
    report = usage.data;
    settings = registered.data?.settings ?? [];
  }

  /** Runs one maintenance pass and reports what it changed. */
  async function evict(): Promise<void> {
    const answer = await nativeClient.POST('/api/v1/admin/storage/evict');
    if (answer.data === undefined) {
      toasts.push(problemMessage(answer.error, 'Could not run the maintenance pass.'), 'error');
      return;
    }
    toasts.push(maintenanceText(answer.data));
    await load();
  }
</script>

<svelte:head>
  <title>Storage - Hearthsound</title>
</svelte:head>

<section class="page">
  <header class="header">
    <h1>Storage</h1>
    <button type="button" onclick={evict}>Evict now</button>
  </header>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  {#if report !== null}
    <div class="cards">
      <article class="card">
        <h2 class="card-title">Cache</h2>
        <p class="card-value">{formatBytes(report.cache.bytes)}</p>
        <p class="card-detail">{report.cache.files} files</p>
      </article>
      <article class="card">
        <h2 class="card-title">Library</h2>
        <p class="card-value">{formatBytes(report.library.bytes)}</p>
        <p class="card-detail">{report.library.files} files</p>
      </article>
      <article class="card">
        <h2 class="card-title">Folders</h2>
        <p class="card-value">{formatBytes(report.folders.bytes)}</p>
        <p class="card-detail">{report.folders.files} files</p>
      </article>
      <article class="card">
        <h2 class="card-title">Pinned tracks</h2>
        <p class="card-value">{report.pinnedTracks}</p>
      </article>
      {#if report.filesystem !== null && report.filesystem !== undefined}
        <article class="card">
          <h2 class="card-title">Filesystem</h2>
          <p class="card-value">{formatBytes(report.filesystem.availableBytes)} free</p>
          <p class="card-detail">of {formatBytes(report.filesystem.totalBytes)}</p>
        </article>
      {/if}
    </div>
  {/if}

  <h2 class="section-title">Policy</h2>
  <div class="policy">
    {#each policy as setting (setting.key)}
      <SettingField {setting} onchanged={(changed) => (settings = changed)} />
    {/each}
  </div>
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

  .header button {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .cards {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
  }

  .card {
    flex: 1 1 10rem;
    padding: var(--space-3);
    background: var(--color-bg-raised);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .card-title {
    margin: 0;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .card-value {
    margin: var(--space-1) 0 0;
    font-size: 1.25rem;
  }

  .card-detail {
    margin: 0;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .section-title {
    margin: 0;
    font-size: 1.125rem;
  }

  .policy {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .failure {
    margin: 0;
    color: var(--color-danger);
  }
</style>
