<!--
  The storage the server manages (p26 B, p26-key A, p26c, k28).

  One group counts the scanned folders as the Library, the managed copies as
  Downloads and the cache, against every filesystem the server touches (the
  storage root's and each folder's) in a 14 px stacked bar, with a legend, and
  names the pinned tracks; then the Policy heading and the setting rows that
  decide what is kept, evicted and demoted. The rows use the settings page's shape: a
  readable title, the server's description, the pin's origin where one applies,
  a control that saves on its own and "Use Default" in the row menu. The
  maintenance pass is the same one the background worker runs.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import SettingField from '#lib/admin/SettingField.svelte';
  import { maintenanceText, policySettings, usageView } from '#lib/admin/storage';
  import type { StorageReport } from '#lib/admin/storage';
  import { problemMessage } from '#lib/admin/problem';
  import type { ServerSetting } from '#lib/admin/settings';
  import { nativeClient } from '#lib/api/native';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Button from '#lib/ui/Button.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  const shell = getShellNavigation();

  let report = $state<StorageReport | null>(null);
  let settings = $state<ServerSetting[]>([]);
  let failed = $state(false);
  let evicting = $state(false);

  const policy = $derived(policySettings(settings));
  const usage = $derived(report === null ? null : usageView(report));

  onMount(() => {
    void load();
  });

  /** Loads the usage and the settings the policy rows edit. */
  async function load(): Promise<void> {
    const [answer, registered] = await Promise.all([
      nativeClient.GET('/api/v1/admin/storage'),
      nativeClient.GET('/api/v1/admin/settings')
    ]);
    if (answer.data === undefined || registered.data === undefined) {
      failed = true;
      return;
    }
    failed = false;
    report = answer.data;
    settings = registered.data.settings;
  }

  /** Runs one maintenance pass and reports what it changed. */
  async function evict(): Promise<void> {
    evicting = true;
    const answer = await nativeClient.POST('/api/v1/admin/storage/evict');
    evicting = false;
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

{#snippet evictAction()}
  <Button
    header
    icon="adwaita-delete"
    label="Evict Now"
    busy={evicting}
    onclick={() => void evict()}
  >
    Evict Now
  </Button>
{/snippet}

{#snippet retryAction()}
  <Button onclick={() => void load()}>Retry</Button>
{/snippet}

<PageHeader
  title="Storage"
  class="admin-header"
  onnavigation={shell?.openNavigation}
  actions={failed ? undefined : evictAction}
/>

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
    <div class="hs-storage-usage">
      {#if usage === null}
        <Skeleton width="100%" height="14px" radius="full" />
        <div class="hs-storage-legend">
          {#each [0, 1, 2, 3] as item (item)}
            <span class="hs-storage-legend__item" aria-hidden="true">
              <Skeleton width="12px" height="12px" />
              <span class="hs-storage-legend__text">
                <Skeleton width="60%" height="12px" />
                <Skeleton width="80%" height="10px" />
              </span>
            </span>
          {/each}
        </div>
        <Skeleton width="110px" height="12px" />
      {:else}
        <div class="hs-storage-bar" aria-hidden="true">
          {#each usage.parts as part (part.key)}
            <i class="hs-storage-bar__{part.key}" style:width="{part.percent}%"></i>
          {/each}
        </div>
        <div class="hs-storage-legend">
          {#each usage.parts as part (part.key)}
            <span class="hs-storage-legend__item">
              <i class="hs-storage-legend__swatch hs-storage-legend__swatch--{part.key}"></i>
              <span class="hs-storage-legend__text">
                <span>{part.label}</span>
                <span class="hs-setting-row__subtitle">{part.detail}</span>
              </span>
            </span>
          {/each}
        </div>
        <p class="hs-storage-pinned">{usage.pinned}</p>
      {/if}
    </div>

    <section class="block">
      <h2 class="hs-section-header__title group-heading">Policy</h2>

      <div class="hs-settings-group policy">
        {#each policy as setting (setting.key)}
          <SettingField {setting} onchanged={(changed) => (settings = changed)} />
        {/each}
      </div>
    </section>
  {/if}
</div>

<style>
  /* Layout glue only: the shell already holds the page off the window edge, so
     the k25 header aligns to that margin. The class lands on the component's
     own header, hence `:global`. */
  :global(.admin-header) {
    padding-inline: 0;
  }

  /* Layout glue only: p26 puts the usage group, the Policy heading and its rows
     under the header and leaves the page 28 px at the bottom. */
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    padding-block: 0 var(--hs-space-7);
  }

  /* Layout glue only: the boards put the policy rows 10 px under the Policy
     heading and the heading 10 px below the gap above it. The package carries
     the 19/750 type on `hs-section-header__title` and no page-group heading
     class. */
  .block {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .group-heading {
    margin: 10px 0 0;
  }

  /* Layout glue only: the group clips its overflow to round its corners, which
     would cut off a row's menu popover. */
  .policy {
    max-width: 760px;
    overflow: visible;
  }
</style>
