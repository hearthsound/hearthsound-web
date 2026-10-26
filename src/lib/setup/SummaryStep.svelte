<!--
  The summary step: what answers, and what the folders are doing (p06).

  Every configured instance is asked to prove it can serve, the server's own
  readiness probe is read beside them, and each folder reports the scan it ran,
  or the scan it is running when one is heard through the event stream. A row
  shows a k09 spinner while its check runs, a health indicator once it answers,
  and Retry only when it could not serve. Finish opens Home.

  Above the instances, one warning line names every required layer that nothing
  serves, the same lines the configuration step draws. A folder whose last scan
  failed reports the failure rather than waiting for a first scan that already
  ran.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import { listFolders } from '#lib/admin/api/folders';
  import { listPlugins } from '#lib/admin/api/plugins';
  import { checkProviderHealth, listProviders } from '#lib/admin/api/providers';
  import { failedScanText, scanProgressText } from '#lib/admin/folders';
  import type { FolderView } from '#lib/admin/folders';
  import type { ProviderView } from '#lib/admin/providers';
  import { emptyLayerWarnings } from '#lib/setup/steps';
  import { events } from '#lib/stores/events.svelte';
  import type { ScanProgressPayload } from '#lib/stores/events.svelte';

  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import HealthIndicator from '#lib/ui/HealthIndicator.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import ProgressBar from '#lib/ui/ProgressBar.svelte';
  import Spinner from '#lib/ui/Spinner.svelte';
  import { tooltip } from '#lib/ui/tooltip.svelte';
  import SetupFooter from './SetupFooter.svelte';

  /** One instance and what its health check answered. */
  interface Row {
    /** The instance slug. */
    slug: string;
    /** The name shown for the instance. */
    displayName: string;
    /** Whether the instance answered that it can serve; `null` while checking. */
    ok: boolean | null;
    /** What the probe reported. */
    detail: string;
  }

  /** Props of the step. */
  interface Props {
    /** Leaves the wizard. */
    oncontinue: () => void;
    /** Moves back to the previous step. */
    onback?: () => void;
  }

  let { oncontinue, onback }: Props = $props();

  let rows = $state<Row[]>([]);
  let folders = $state<FolderView[]>([]);
  let scans = $state<Record<string, ScanProgressPayload>>({});
  let server = $state<{ ok: boolean | null; detail: string } | null>(null);
  let failure = $state<string | null>(null);
  /** The warnings of the required layers nothing serves (A-web-admin-11). */
  let warnings = $state<string[]>([]);

  onMount(() => {
    void checkAll();
    void loadFolders();
    return events.on('scan.progress', (event) => {
      scans = { ...scans, [event.data.folderId]: event.data };
    });
  });

  /**
   * Asks one instance to prove it can serve.
   *
   * @param slug The instance to check.
   * @returns What the check answered.
   */
  async function check(slug: string): Promise<{ ok: boolean; detail: string }> {
    const result = await checkProviderHealth(slug, 'The check did not run.');
    if (!result.ok) {
      return { ok: false, detail: result.message };
    }
    return { ok: result.value.ok, detail: result.value.detail };
  }

  /**
   * Asks one instance again.
   *
   * @param row The instance to check.
   */
  async function retry(row: Row): Promise<void> {
    rows = rows.map((existing) =>
      existing.slug === row.slug ? { ...existing, ok: null, detail: '' } : existing
    );
    const answer = await check(row.slug);
    rows = rows.map((existing) =>
      existing.slug === row.slug ? { ...existing, ...answer } : existing
    );
  }

  /**
   * Reads the server's own readiness probe. The probe answers the bare word
   * "ready" when it is ready, which only repeats the row's state, so that body
   * is not shown as a detail. A probe that never answered leaves the row
   * refused, with the Retry it offers for every refusal, instead of spinning.
   */
  async function checkServer(): Promise<void> {
    server = { ok: null, detail: '' };
    try {
      const probe = await fetch('/readyz');
      const text = (await probe.text()).trim();
      const detail = text === '' ? probe.statusText : text;
      server = { ok: probe.ok, detail: detail.toLowerCase() === 'ready' ? '' : detail };
    } catch {
      server = { ok: false, detail: 'The server did not answer.' };
    }
  }

  /**
   * Loads the instances, checks every one of them and the server, and words the
   * warnings of the required layers nothing serves.
   *
   * A plugin list the server refused leaves the warnings empty: a list the step
   * could not read is not a list of absent plugins.
   */
  async function checkAll(): Promise<void> {
    const [instances, installed] = await Promise.all([listProviders(), listPlugins()]);
    if (!instances.ok) {
      failure = instances.message;
      return;
    }
    failure = null;
    warnings = installed.ok ? emptyLayerWarnings(instances.value, installed.value) : [];
    rows = instances.value.map((provider: ProviderView) => ({
      slug: provider.slug,
      displayName: provider.displayName,
      ok: null,
      detail: ''
    }));
    await Promise.all([checkServer(), ...rows.map((row) => retry(row))]);
  }

  /** Loads the folders and the scan each one reported. */
  async function loadFolders(): Promise<void> {
    const result = await listFolders();
    if (!result.ok) {
      return;
    }
    folders = result.value;
  }

  /**
   * Returns the status line of one folder.
   *
   * The live scan comes first, because it is what the folder is doing now; a
   * stored failure follows it, then the last successful scan, and only a folder
   * that never ran one waits for its first. A failure is the server's own
   * sentence, so the line shows it unchanged (E-A-8).
   *
   * @param folder The folder.
   * @returns The line its row shows.
   */
  function scanLine(folder: FolderView): string {
    const progress = scans[folder.id];
    if (progress !== undefined) {
      return scanProgressText(progress);
    }
    const failed = failedScanText(folder);
    if (failed !== null) {
      return failed;
    }
    if (folder.lastScanAt !== undefined && folder.lastScanAt !== null) {
      return `Last scan ${new Date(folder.lastScanAt).toLocaleString()}`;
    }
    return 'Waiting for its first scan';
  }

  /**
   * Reports whether a folder's row shows a failure line.
   *
   * A live frame that carries a problem is the terminal frame of a scan that
   * stopped or finished with a warning, and its sentence is the same one the
   * folder row stores, so it is styled like the stored failure; a frame without
   * one keeps the plain style the other live lines have (E-A-8).
   *
   * @param folder The folder.
   * @returns Whether the row's line is a failure.
   */
  function scanFailed(folder: FolderView): boolean {
    const progress = scans[folder.id];
    if (progress !== undefined) {
      return progress.error !== undefined && progress.error !== '';
    }
    return failedScanText(folder) !== null;
  }

  /**
   * Reports whether a folder is scanning right now.
   *
   * @param folder The folder.
   * @returns Whether its latest progress is still running.
   */
  function scanning(folder: FolderView): boolean {
    const progress = scans[folder.id];
    return progress !== undefined && progress.error === undefined && progress.phase !== 'done';
  }
</script>

<section class="hs-form">
  <div class="hs-setup">
    <h2 class="hs-title-3 step-title">Summary</h2>
    <p class="step-lead">
      Every instance is asked whether it can serve. One that does not answer can be set up again
      under the admin views after the wizard, and the folders below report the scan they are
      running.
    </p>

    {#if failure !== null}
      <Banner level="error" text={failure} />
    {/if}

    {#if warnings.length > 0}
      <div class="hs-settings-group warnings">
        {#each warnings as warning (warning)}
          <p class="hs-setting-row__subtitle warning" role="status">
            <Icon name="adwaita-warning" class="hs-setting-row__icon" />
            {warning}
          </p>
        {/each}
      </div>
    {/if}

    {#if rows.length === 0 && failure === null}
      <p class="hs-setting-row__subtitle">No instance is configured yet.</p>
    {/if}

    <div class="hs-settings-group">
      {#each rows as row (row.slug)}
        <div class="hs-setting-row hs-setting-row--two-line">
          <span class="leading">
            {#if row.ok === null}
              <Spinner />
            {:else}
              <HealthIndicator
                state={row.ok ? 'success' : 'error'}
                label={row.ok ? 'Healthy' : 'Failed'}
              />
            {/if}
          </span>
          <span class="hs-setting-row__text">
            <span>{row.displayName}</span>
            {#if row.ok !== null}
              <span
                class="hs-setting-row__subtitle"
                class:hs-setting-row__subtitle--error={!row.ok}
              >
                {row.ok ? 'Ready' : 'Not ready'} - {row.detail}
              </span>
            {/if}
          </span>
          {#if row.ok === false}
            <button
              class="hs-button hs-button--flat hs-button--icon"
              type="button"
              aria-label="Retry"
              {@attach tooltip('Retry')}
              onclick={() => retry(row)}
            >
              <Icon name="adwaita-refresh" class="hs-button__icon" />
            </button>
          {/if}
        </div>
      {/each}

      {#if server !== null}
        <div class="hs-setting-row hs-setting-row--two-line">
          <span class="leading">
            {#if server.ok === null}
              <Spinner />
            {:else}
              <HealthIndicator
                state={server.ok ? 'success' : 'error'}
                label={server.ok ? 'Healthy' : 'Failed'}
              />
            {/if}
          </span>
          <span class="hs-setting-row__text">
            <span>The server itself</span>
            {#if server.ok !== null}
              <span
                class="hs-setting-row__subtitle"
                class:hs-setting-row__subtitle--error={!server.ok}
              >
                {server.ok ? 'Ready' : 'Not ready'}{server.detail === ''
                  ? ''
                  : ` - ${server.detail}`}
              </span>
            {/if}
          </span>
          {#if server.ok === false}
            <button
              class="hs-button hs-button--flat hs-button--icon"
              type="button"
              aria-label="Retry"
              {@attach tooltip('Retry')}
              onclick={checkServer}
            >
              <Icon name="adwaita-refresh" class="hs-button__icon" />
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if folders.length > 0}
      <h3 class="hs-title-4">Music folders</h3>

      <div class="folders">
        {#each folders as folder (folder.id)}
          <div class="hs-settings-group">
            <div class="hs-setting-row hs-setting-row--two-line">
              <Icon name="adwaita-folder" class="hs-setting-row__icon" />
              <span class="hs-setting-row__text">
                <span class="hs-setting-row__subtitle hs-setting-row__subtitle--mono path">
                  {folder.path}
                </span>
                <span
                  class="hs-setting-row__subtitle"
                  class:hs-setting-row__subtitle--error={scanFailed(folder)}
                  role="status">{scanLine(folder)}</span
                >
                {#if scanning(folder)}
                  <ProgressBar label="Scanning" />
                {/if}
              </span>
            </div>
          </div>
        {/each}
      </div>
    {/if}

    <SetupFooter {onback}>
      <Button variant="suggested" onclick={oncontinue}>Finish</Button>
    </SetupFooter>
  </div>
</section>

<style>
  .step-title,
  .step-lead {
    margin: 0;
  }

  .leading {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
  }

  .path {
    overflow-wrap: anywhere;
  }

  .folders {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-2);
  }

  /* A warning line is a row's subtitle with the warning glyph beside it, which
     no package class puts on one line; only the box is set here. */
  .warning {
    display: flex;
    align-items: center;
    gap: var(--hs-space-2);
    margin: 0;
    padding: var(--hs-space-2) var(--hs-space-3);
  }
</style>
