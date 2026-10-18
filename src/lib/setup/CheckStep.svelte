<!--
  The check step: what answers, and what the folders are doing.

  Every configured instance is asked to prove it can serve, the server's own
  readiness probe is read beside them, and each folder reports the scan it ran,
  or the scan it is running when one is heard through the event stream. An
  instance that fails can be asked again before the wizard is left.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import { scanProgressText } from '#lib/admin/folders';
  import type { FolderView } from '#lib/admin/folders';
  import { problemMessage } from '#lib/admin/problem';
  import type { ProviderView } from '#lib/admin/providers';
  import { nativeClient } from '#lib/api/native';
  import { events } from '#lib/stores/events.svelte';

  /** One instance and what its health check answered. */
  interface Row {
    /** The instance slug. */
    slug: string;
    /** The name shown for the instance. */
    displayName: string;
    /** Whether the instance answered that it can serve. */
    ok: boolean;
    /** What the probe reported. */
    detail: string;
  }

  /** Props of the step. */
  interface Props {
    /** Leaves the wizard. */
    oncontinue: () => void;
  }

  let { oncontinue }: Props = $props();

  let rows = $state<Row[]>([]);
  let folders = $state<FolderView[]>([]);
  let scans = $state<Record<string, string>>({});
  let ready = $state<{ ok: boolean; detail: string } | null>(null);
  let failure = $state<string | null>(null);
  let busy = $state<string | null>(null);

  onMount(() => {
    void checkAll();
    void loadFolders();
    return events.on('scan.progress', (event) => {
      scans = { ...scans, [event.data.folderId]: scanProgressText(event.data) };
    });
  });

  /**
   * Asks one instance to prove it can serve.
   *
   * @param slug The instance to check.
   * @returns What the check answered.
   */
  async function check(slug: string): Promise<{ ok: boolean; detail: string }> {
    const answer = await nativeClient.GET('/api/v1/admin/providers/{slug}/health', {
      params: { path: { slug } }
    });
    if (answer.data === undefined) {
      return { ok: false, detail: problemMessage(answer.error, 'The check did not run.') };
    }
    return { ok: answer.data.ok, detail: answer.data.detail };
  }

  /** Loads the instances, the readiness probe and a check of every instance. */
  async function checkAll(): Promise<void> {
    const [instances, probe] = await Promise.all([
      nativeClient.GET('/api/v1/admin/providers'),
      fetch('/readyz')
    ]);
    if (instances.data === undefined) {
      failure = problemMessage(instances.error, 'Could not load the instances.');
      return;
    }
    failure = null;
    const text = (await probe.text()).trim();
    ready = { ok: probe.ok, detail: text === '' ? probe.statusText : text };
    rows = await Promise.all(
      instances.data.providers.map(async (provider: ProviderView) => ({
        slug: provider.slug,
        displayName: provider.displayName,
        ...(await check(provider.slug))
      }))
    );
  }

  /** Loads the folders and the scan each one reported. */
  async function loadFolders(): Promise<void> {
    const answer = await nativeClient.GET('/api/v1/admin/folders');
    if (answer.data === undefined) {
      return;
    }
    folders = answer.data.folders;
  }

  /**
   * Asks one instance again.
   *
   * @param row The instance to check.
   */
  async function retry(row: Row): Promise<void> {
    busy = row.slug;
    const answer = await check(row.slug);
    busy = null;
    rows = rows.map((existing) =>
      existing.slug === row.slug ? { ...existing, ...answer } : existing
    );
  }
</script>

<section class="step">
  <h2>Check</h2>
  <p>
    Every instance is asked whether it can serve. One that does not answer can be set up again under
    the admin views after the wizard, and the folders below report the scan they are running.
  </p>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  <table class="table">
    <thead>
      <tr>
        <th scope="col">Instance</th>
        <th scope="col">State</th>
        <th scope="col"><span class="visually-hidden">Commands</span></th>
      </tr>
    </thead>
    <tbody>
      {#each rows as row (row.slug)}
        <tr>
          <td class="name">{row.displayName}</td>
          <td class:failed={!row.ok}>
            {row.ok ? 'Ready' : 'Not ready'} - {row.detail}
          </td>
          <td>
            <button type="button" onclick={() => retry(row)} disabled={busy === row.slug}>
              Retry
            </button>
          </td>
        </tr>
      {/each}
      {#if ready !== null}
        <tr>
          <td class="name">The server itself</td>
          <td class:failed={!ready.ok}>{ready.ok ? 'Ready' : 'Not ready'} - {ready.detail}</td>
          <td>
            <button type="button" onclick={checkAll}>Retry</button>
          </td>
        </tr>
      {/if}
    </tbody>
  </table>

  {#if rows.length === 0 && failure === null}
    <p class="hint">No instance is configured yet.</p>
  {/if}

  {#if folders.length > 0}
    <h3>Music folders</h3>
    <ul class="folders">
      {#each folders as folder (folder.id)}
        <li>
          <span class="path">{folder.path}</span>
          <span class="hint" role="status">
            {scans[folder.id] ??
              (folder.lastScanAt === undefined || folder.lastScanAt === null
                ? 'Waiting for its first scan'
                : `Last scan ${new Date(folder.lastScanAt).toLocaleString()}`)}
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="commands">
    <button class="primary" type="button" onclick={oncontinue}>Finish</button>
  </div>
</section>

<style>
  .step {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .step h2 {
    margin: 0;
    font-size: 1.25rem;
  }

  .step h3 {
    margin: 0;
    font-size: 1rem;
  }

  .step p {
    margin: 0;
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

  .name {
    font-weight: 600;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .failed {
    color: var(--color-danger);
  }

  .folders {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .folders li {
    display: flex;
    gap: var(--space-2);
    flex-wrap: wrap;
  }

  .path {
    font-family: var(--font-mono);
  }

  .hint {
    margin: 0;
    color: var(--color-fg-muted);
  }

  .failure {
    margin: 0;
    color: var(--color-danger);
  }

  .commands {
    display: flex;
    gap: var(--space-2);
  }

  .commands button {
    padding: var(--space-2) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .commands .primary {
    color: var(--color-accent-fg);
    background: var(--color-accent);
    border-color: var(--color-accent);
  }
</style>
