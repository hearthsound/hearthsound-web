<!--
  The administration overview (l10 B, E2, c04, k28).

  The first row of the admin sidebar opens this page: six cards, each the link
  to one area, with that area's key number and a line of context. The counts
  come from the endpoints the areas already use. A card whose area counts
  health states shows one k10 pill per state present with its count; the
  storage card shows a k09 bar of the disk used instead of a number. A read that
  fails is the page-wide o03 status page with Retry.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import type { IconName } from '@hearthsound/design/icons';

  import { formatBytes } from '#lib/admin/bytes';
  import { lastScanText } from '#lib/admin/folders';
  import type { FolderView } from '#lib/admin/folders';
  import { problemMessage } from '#lib/admin/problem';
  import type { StorageReport } from '#lib/admin/storage';
  import type { AdminUser } from '#lib/admin/users';
  import { nativeClient } from '#lib/api/native';
  import type { components } from '#lib/api/schema';
  import { events } from '#lib/stores/events.svelte';
  import type { ScanProgressPayload } from '#lib/stores/events.svelte';
  import Button from '#lib/ui/Button.svelte';
  import CountBadge from '#lib/ui/CountBadge.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import type { PillTone } from '#lib/ui/Pill.svelte';
  import ProgressBar from '#lib/ui/ProgressBar.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  type PluginView = components['schemas']['PluginView'];
  type ProviderView = components['schemas']['ProviderView'];
  type AcquisitionView = components['schemas']['AcquisitionView'];
  type UserPage = components['schemas']['UserPage'];

  /** One health state a provider reports, with how many instances hold it. */
  interface HealthCount {
    /** The state colour. */
    tone: PillTone;
    /** The state glyph. */
    glyph: IconName;
    /** The visible label. */
    label: string;
    /** How many instances are in that state. */
    count: number;
  }

  let users = $state<AdminUser[]>([]);
  let folders = $state<FolderView[]>([]);
  let plugins = $state<PluginView[]>([]);
  let providers = $state<ProviderView[]>([]);
  let storage = $state<StorageReport | null>(null);
  let running = $state(0);
  let failed = $state(0);
  let scans = $state<Record<string, ScanProgressPayload>>({});
  let loading = $state(true);
  let failure = $state<string | null>(null);

  const administrators = $derived(users.filter((user) => user.isAdmin).length);
  const states = $derived(healthCounts(providers));

  onMount(() => {
    void load();
    return events.on('scan.progress', (event) => {
      scans = { ...scans, [event.data.folderId]: event.data };
    });
  });

  /**
   * Reads every area's count, then the whole page settles.
   */
  async function load(): Promise<void> {
    loading = true;
    const [accounts, folderList, pluginList, providerList, report, active, recent] =
      await Promise.all([
        listEveryUser(),
        nativeClient.GET('/api/v1/admin/folders'),
        nativeClient.GET('/api/v1/admin/plugins'),
        nativeClient.GET('/api/v1/admin/providers'),
        nativeClient.GET('/api/v1/admin/storage'),
        nativeClient.GET('/api/v1/admin/acquisitions', { params: { query: { state: 'active' } } }),
        nativeClient.GET('/api/v1/admin/acquisitions', { params: { query: { state: 'recent' } } })
      ]);
    loading = false;
    const answers = [folderList, pluginList, providerList, report, active, recent];
    const broken = answers.find((answer) => answer.data === undefined);
    if (accounts === null || broken !== undefined) {
      failure = problemMessage(
        accounts === null ? undefined : broken?.error,
        'Could not load the overview.'
      );
      return;
    }
    failure = null;
    users = accounts;
    folders = folderList.data?.folders ?? [];
    plugins = pluginList.data?.plugins ?? [];
    providers = providerList.data?.providers ?? [];
    storage = report.data ?? null;
    running = (active.data?.acquisitions ?? []).length;
    failed = (recent.data?.acquisitions ?? []).filter((row) => row.state === 'failed').length;
  }

  /**
   * Reads every page of accounts, for the count the Users card shows.
   *
   * @returns Every account, or `null` when a page could not be read.
   */
  async function listEveryUser(): Promise<AdminUser[] | null> {
    const all: AdminUser[] = [];
    let cursor: string | null = null;
    for (;;) {
      const answer = (await nativeClient.GET('/api/v1/admin/users', {
        params: { query: cursor === null ? { limit: 100 } : { limit: 100, cursor } }
      })) as { data?: UserPage; error?: unknown };
      if (answer.data === undefined) {
        return null;
      }
      all.push(...answer.data.users);
      cursor = answer.data.nextCursor ?? null;
      if (cursor === null) {
        return all;
      }
    }
  }

  /**
   * Counts the provider health states present.
   *
   * @param entries The instances to count.
   * @returns One entry per state that has at least one instance, in the order
   *   healthy, failed, not checked.
   */
  function healthCounts(entries: readonly ProviderView[]): HealthCount[] {
    const counts: HealthCount[] = [
      { tone: 'success', glyph: 'adwaita-check', label: 'Ready', count: 0 },
      { tone: 'error', glyph: 'adwaita-error', label: 'Failed', count: 0 },
      { tone: 'neutral', glyph: 'custom-unknown', label: 'Not checked yet', count: 0 }
    ];
    for (const entry of entries) {
      if (entry.health === null || entry.health === undefined) {
        counts[2].count += 1;
      } else if (entry.health.ok) {
        counts[0].count += 1;
      } else {
        counts[1].count += 1;
      }
    }
    return counts.filter((state) => state.count > 0);
  }

  /** The scan line of the folders card: the live scan, or the last one. */
  const folderLine = $derived.by(() => {
    const live = Object.values(scans).find((scan) => scan.phase !== 'done');
    if (live !== undefined) {
      return `${live.phase === 'pruning' ? 'Removing missing files' : 'Scanning'}: ${live.filesDone} of ${live.filesSeen} files`;
    }
    const latest = folders
      .map((folder) => folder.lastScanAt ?? 0)
      .reduce((newest, at) => (at > newest ? at : newest), 0);
    return lastScanText(latest === 0 ? null : latest);
  });

  /** The storage card's used and total bytes, summed over every filesystem. */
  const disk = $derived.by(() => {
    const report = storage;
    if (report === null) {
      return { percent: 0, line: '' };
    }
    const used = report.library.bytes + report.cache.bytes + report.folders.bytes;
    const total = (report.filesystems ?? []).reduce((sum, entry) => sum + entry.totalBytes, 0);
    const percent = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0;
    return {
      percent,
      line: total > 0 ? `${formatBytes(used)} of ${formatBytes(total)}` : formatBytes(used)
    };
  });
</script>

<svelte:head>
  <title>Overview - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load()}>Retry</Button>
{/snippet}

<PageHeader title="Overview" class="admin-header" />

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
  <div class="hs-admin-overview">
    {#if loading}
      {#each [0, 1, 2, 3, 4, 5] as card (card)}
        <div class="hs-admin-card" aria-hidden="true">
          <Skeleton width="55%" height="14px" />
          <Skeleton width="30%" height="29px" />
          <Skeleton width="65%" height="12px" />
        </div>
      {/each}
    {:else}
      <a class="hs-admin-card" href="/admin/users" aria-label="Open Users">
        <span class="hs-admin-card__header">
          <Icon name="adwaita-users" />
          <span>Users</span>
          <Icon name="adwaita-forward" />
        </span>
        <span class="hs-admin-card__number">{users.length}</span>
        <span class="hs-admin-card__line">
          {administrators}
          {administrators === 1 ? 'administrator' : 'administrators'}
        </span>
      </a>

      <a class="hs-admin-card" href="/admin/folders" aria-label="Open Music folders">
        <span class="hs-admin-card__header">
          <Icon name="adwaita-folder" />
          <span>Music folders</span>
          <Icon name="adwaita-forward" />
        </span>
        <span class="hs-admin-card__number">{folders.length}</span>
        <span class="hs-admin-card__line">{folderLine}</span>
      </a>

      <a class="hs-admin-card" href="/admin/plugins" aria-label="Open Plugins">
        <span class="hs-admin-card__header">
          <Icon name="adwaita-plugin" />
          <span>Plugins</span>
          <Icon name="adwaita-forward" />
        </span>
        <span class="hs-admin-card__number">{plugins.length}</span>
        <span class="hs-admin-card__line">installed</span>
      </a>

      <a class="hs-admin-card" href="/admin/providers" aria-label="Open Providers">
        <span class="hs-admin-card__header">
          <Icon name="adwaita-remote" />
          <span>Providers</span>
          <Icon name="adwaita-forward" />
        </span>
        <span class="hs-admin-card__number">{providers.length}</span>
        {#if states.length > 0}
          <span class="pills">
            {#each states as state (state.label)}
              <span class="pills__item">
                <Pill tone={state.tone} glyph={state.glyph} label={state.label} />
                <CountBadge count={state.count} />
              </span>
            {/each}
          </span>
        {/if}
      </a>

      <a class="hs-admin-card" href="/admin/storage" aria-label="Open Storage">
        <span class="hs-admin-card__header">
          <Icon name="adwaita-storage" />
          <span>Storage</span>
          <Icon name="adwaita-forward" />
        </span>
        <ProgressBar label="Storage used" value={disk.percent} />
        <span class="hs-admin-card__line">{disk.line}</span>
      </a>

      <a class="hs-admin-card" href="/admin/acquisitions" aria-label="Open Acquisitions">
        <span class="hs-admin-card__header">
          <Icon name="adwaita-acquire" />
          <span>Acquisitions</span>
          <Icon name="adwaita-forward" />
        </span>
        <span class="hs-admin-card__number">{running}</span>
        <span class="hs-admin-card__line">{failed} failed</span>
      </a>
    {/if}
  </div>
{/if}

<style>
  /* Layout glue only: the shell already holds the page off the window edge, so
     the k25 header aligns to that margin. */
  :global(.admin-header) {
    padding-inline: 0;
  }

  /* Layout glue only: the page's card grid under the header, and the state page
     filling the column when the read fails. */
  .hs-admin-overview {
    padding-block: var(--hs-space-4) var(--hs-space-7);
  }

  .state {
    display: flex;
    flex-direction: column;
    min-height: 60vh;
  }

  /* Layout glue only: the cards' pills wrap with their counts; the package
     draws one pill per line in the admin row, not a count per state. */
  .pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .pills__item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
</style>
