<!--
  The provider instances (p25 B, k28, k10, k34).

  One grey group lists the instances: the display name with its mono slug, the
  plugin the instance is configured from in the muted second line, the health
  pill at the right and the row menu that checks its health, edits it or
  deletes it. The 640 px instance dialog adds one from an installed plugin or
  changes one; deleting is a k19 alert.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { IconName } from '@hearthsound/design/icons';

  import ProviderForm from '#lib/admin/ProviderForm.svelte';
  import { problemMessage } from '#lib/admin/problem';
  import type { ProviderView } from '#lib/admin/providers';
  import type { PluginView } from '#lib/admin/plugins';
  import { nativeClient } from '#lib/api/native';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import type { PillTone } from '#lib/ui/Pill.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  const shell = getShellNavigation();

  let providers = $state<ProviderView[]>([]);
  let plugins = $state<PluginView[]>([]);
  let failure = $state<string | null>(null);
  let loading = $state(true);
  let adding = $state(false);
  let editing = $state<ProviderView | null>(null);
  let deleting = $state<ProviderView | null>(null);
  let deletingBusy = $state(false);

  const takenSlugs = $derived(providers.map((provider) => provider.slug));
  const installable = $derived(plugins.filter((plugin) => plugin.enabled));
  const pluginNames = $derived(new Map(plugins.map((plugin) => [plugin.id, plugin.name])));

  onMount(() => {
    void load();
  });

  /** Loads the instances and the plugins they may be configured from. */
  async function load(): Promise<void> {
    loading = true;
    const [instances, installed] = await Promise.all([
      nativeClient.GET('/api/v1/admin/providers'),
      nativeClient.GET('/api/v1/admin/plugins')
    ]);
    loading = false;
    if (instances.data === undefined) {
      failure = problemMessage(instances.error, 'Could not load the instances.');
      return;
    }
    failure = null;
    providers = instances.data.providers;
    plugins = installed.data?.plugins ?? [];
  }

  /**
   * Returns the pill of one instance's last health check.
   *
   * @param health The health the server recorded, when it has one.
   * @returns The tone, glyph and label: the probe's line in success, the
   *   failure's line in error, and "Not checked yet" in neutral (p25 B, k10).
   */
  function healthPill(health: ProviderView['health']): {
    tone: PillTone;
    glyph: IconName;
    label: string;
  } {
    if (health === null || health === undefined) {
      return { tone: 'neutral', glyph: 'custom-unknown', label: 'Not checked yet' };
    }
    const detail = health.detail.trim();
    return health.ok
      ? { tone: 'success', glyph: 'adwaita-check', label: detail === '' ? 'Healthy' : detail }
      : { tone: 'error', glyph: 'adwaita-error', label: detail === '' ? 'Failed' : detail };
  }

  /**
   * Runs one instance's health check.
   *
   * @param provider The instance to check.
   */
  async function checkHealth(provider: ProviderView): Promise<void> {
    const answer = await nativeClient.GET('/api/v1/admin/providers/{slug}/health', {
      params: { path: { slug: provider.slug } }
    });
    const health = answer.data;
    if (health === undefined) {
      toasts.push(problemMessage(answer.error, 'Could not check the instance.'), 'error');
      return;
    }
    providers = providers.map((existing) =>
      existing.slug === health.slug ? { ...existing, health } : existing
    );
  }

  /** Deletes the instance the confirmation shows. */
  async function remove(): Promise<void> {
    const provider = deleting;
    if (provider === null) {
      return;
    }
    deletingBusy = true;
    const answer = await nativeClient.DELETE('/api/v1/admin/providers/{slug}', {
      params: { path: { slug: provider.slug } }
    });
    deletingBusy = false;
    if (answer.response.status !== 204) {
      toasts.push(problemMessage(answer.error, 'Could not remove the instance.'), 'error');
      return;
    }
    providers = providers.filter((existing) => existing.slug !== provider.slug);
    deleting = null;
  }

  /**
   * Adds an instance the server just configured.
   *
   * @param provider The instance.
   */
  function added(provider: ProviderView): void {
    adding = false;
    providers = [...providers, provider];
  }

  /**
   * Replaces an instance the server just changed.
   *
   * @param provider The instance as it is now.
   */
  function saved(provider: ProviderView): void {
    editing = null;
    providers = providers.map((existing) =>
      existing.slug === provider.slug ? provider : existing
    );
  }
</script>

<svelte:head>
  <title>Instances - Hearthsound</title>
</svelte:head>

{#snippet actions()}
  <Button
    variant="suggested"
    header
    icon="adwaita-add"
    label="Add Instance"
    disabled={installable.length === 0}
    onclick={() => (adding = true)}
  >
    Add Instance
  </Button>
{/snippet}

{#snippet retryAction()}
  <Button onclick={() => void load()}>Retry</Button>
{/snippet}

<PageHeader title="Instances" class="admin-header" onnavigation={shell?.openNavigation} {actions} />

<div class="content">
  {#if failure !== null}
    <StatusPage
      level={2}
      alert
      icon="adwaita-error"
      title="Could Not Load This Page"
      text="The server did not answer. Try again in a moment."
      action={retryAction}
    />
  {:else if providers.length === 0 && !loading}
    <p class="empty">No instances yet. Configure one from an installed plugin.</p>
  {:else}
    <ul class="hs-settings-group rows" aria-label="Instances">
      {#each providers as provider (provider.slug)}
        {@const pill = healthPill(provider.health)}
        <li class="hs-setting-row hs-setting-row--two-line">
          <span class="hs-setting-row__text">
            <span class="title">
              {provider.displayName}
              <span class="slug">{provider.slug}</span>
            </span>
            <span class="hs-setting-row__subtitle plugin">
              {pluginNames.get(provider.pluginId) ?? provider.pluginId}
            </span>
          </span>
          <Pill tone={pill.tone} glyph={pill.glyph} label={pill.label} />
          <Menu label="More Actions" align="end">
            <MenuItem
              label="Check Health"
              icon="adwaita-refresh"
              onselect={() => void checkHealth(provider)}
            />
            <MenuItem label="Edit" icon="adwaita-edit" onselect={() => (editing = provider)} />
            <MenuItem
              label="Delete"
              icon="adwaita-delete"
              destructive
              onselect={() => (deleting = provider)}
            />
          </Menu>
        </li>
      {/each}

      {#if loading && providers.length === 0}
        {#each [0, 1, 2] as row (row)}
          <li class="hs-setting-row" aria-hidden="true">
            <span class="hs-setting-row__text">
              <Skeleton width="30%" height="12px" />
              <Skeleton width="55%" height="10px" />
            </span>
            <Skeleton width="70px" height="22px" radius="full" />
          </li>
        {/each}
      {/if}
    </ul>
  {/if}
</div>

{#if adding}
  <ProviderForm
    provider={null}
    plugins={installable}
    {takenSlugs}
    addLabel="Add Instance"
    onclose={() => (adding = false)}
    onsaved={added}
  />
{/if}

{#if editing !== null}
  <ProviderForm
    provider={editing}
    plugins={installable}
    {takenSlugs}
    namedEdit
    onclose={() => (editing = null)}
    onsaved={saved}
  />
{/if}

{#if deleting !== null}
  <Dialog
    title="Delete Instance?"
    alert
    onclose={() => (deleting = null)}
    description={`${deleting.displayName} stops serving every layer it is in.`}
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
        Delete
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

  /* Layout glue only: p25 puts the group directly under the header and leaves
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

  /* p25 keeps the slug on the display-name line in 12 px mono and truncates
     the pair rather than pushing the health pill; the plugin line truncates
     beside the pill. */
  .title {
    display: block;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .slug {
    margin-left: 4px;
    color: var(--hs-fg-muted);
    font: 400 12px var(--hs-font-mono);
  }

  .plugin {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* p25's phone board stacks the name, the slug and the plugin line beside the
     pill, rather than running the slug beside the name as on desktop. */
  @media (max-width: 720px) {
    .title {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      white-space: normal;
    }

    .slug {
      max-width: 100%;
      margin-left: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }

  /* The muted empty line of p25; the package has no page-text empty class. */
  .empty {
    margin: 0;
    color: var(--hs-fg-muted);
  }
</style>
