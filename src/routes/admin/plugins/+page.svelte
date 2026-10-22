<!--
  The plugins of the server.

  One page of headed groups: Installed lists what is hosted here with its state
  and the commands that switch it off, review its staged upgrade or remove it;
  Available lists what the reachable indexes offer and installs from them;
  Repositories manages where those indexes are read from. Installing grants the
  permissions a plugin's manifest requests and enables it, so an install has no
  approval step of its own; the Review dialog is the only approval left, and it
  opens for an upgrade the server staged because it asks for permissions the
  installed version does not hold. The Add Plugins dialog holds the Repository
  and File tabs.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import AddPluginsDialog from '#lib/admin/AddPluginsDialog.svelte';
  import type { AddPluginsRequest } from '#lib/admin/AddPluginsDialog.svelte';
  import PermissionList from '#lib/admin/PermissionList.svelte';
  import {
    applyPluginUpgrade,
    declinePluginUpgrade,
    installPlugin,
    installPluginArchive,
    listAvailablePlugins,
    listPlugins,
    listRepositories,
    registerRepository,
    removePlugin,
    removeRepository,
    setPluginEnabled
  } from '#lib/admin/api/plugins';
  import { installablePlugins } from '#lib/admin/plugins';
  import type { AvailablePluginView, PluginView, RepositoryView } from '#lib/admin/plugins';
  import type { AdminResult } from '#lib/admin/api/result';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  import AvailablePlugins from './AvailablePlugins.svelte';
  import InstalledPlugins from './InstalledPlugins.svelte';
  import Repositories from './Repositories.svelte';
  import RepositoryDialog from './RepositoryDialog.svelte';

  const shell = getShellNavigation();

  let plugins = $state<PluginView[]>([]);
  let available = $state<AvailablePluginView[]>([]);
  let indexErrors = $state<string[]>([]);
  let repositories = $state<RepositoryView[]>([]);
  let failure = $state<string | null>(null);
  let loading = $state(true);
  let adding = $state(false);
  let reviewing = $state<PluginView | null>(null);
  let editingRepository = $state<RepositoryView | null>(null);
  let removingPlugin = $state<PluginView | null>(null);
  let removingRepository = $state<RepositoryView | null>(null);
  let removing = $state(false);
  let installing = $state<string | null>(null);
  let reviewBusy = $state(false);

  /** The offered entries this server does not already host at the same version. */
  const offered = $derived(installablePlugins(available, plugins));

  onMount(() => {
    void load();
  });

  /** Loads the installed plugins, the offered ones and the repositories. */
  async function load(): Promise<void> {
    loading = true;
    const [installed, offeredList, registered] = await Promise.all([
      listPlugins(),
      listAvailablePlugins(),
      listRepositories()
    ]);
    loading = false;
    if (!installed.ok) {
      failure = installed.message;
      return;
    }
    if (!offeredList.ok) {
      failure = offeredList.message;
      return;
    }
    if (!registered.ok) {
      failure = registered.message;
      return;
    }
    failure = null;
    plugins = installed.value;
    available = offeredList.value.plugins;
    indexErrors = offeredList.value.errors;
    repositories = registered.value;
  }

  /**
   * Installs one plugin an index offers and enables it at once.
   *
   * @param plugin The plugin to install.
   */
  async function install(plugin: AvailablePluginView): Promise<void> {
    installing = plugin.id;
    const installed = await installPlugin(plugin.id, plugin.repositoryId ?? null);
    installing = null;
    if (!installed.ok) {
      toasts.push(installed.message, 'error');
      return;
    }
    toasts.push(`${plugin.name} installed.`);
    await load();
  }

  /**
   * Installs the archive the Add Plugins dialog holds and enables it at once.
   *
   * @param request The dialog's archive.
   * @returns The line to show for a failure, or `null` when the list reloaded.
   */
  async function installFile(request: AddPluginsRequest): Promise<string | null> {
    if (request.kind !== 'file') {
      return null;
    }
    const installed = await installPluginArchive(request.file);
    if (!installed.ok) {
      return installed.message;
    }
    toasts.push(`${installed.value.name} installed.`);
    await load();
    return null;
  }

  /**
   * Registers the repository the Add Plugins dialog holds.
   *
   * @param request The dialog's fields.
   * @returns The line to show for a failure, or `null` when the list reloaded.
   */
  async function addRepository(request: AddPluginsRequest): Promise<string | null> {
    if (request.kind !== 'repository') {
      return null;
    }
    const result = await registerRepository({
      url: request.url,
      name: request.name,
      publicKey: request.publicKey
    });
    if (!result.ok) {
      return result.message;
    }
    await load();
    return null;
  }

  /**
   * Adds the dialog's repository or installs its archive.
   *
   * @param request The dialog's fields.
   * @returns The line to show for a failure, or `null` when the dialog closes.
   */
  function added(request: AddPluginsRequest): Promise<string | null> {
    return request.kind === 'repository' ? addRepository(request) : installFile(request);
  }

  /**
   * Replaces one plugin with the answer of a command, or toasts the refusal.
   *
   * @param result The command's answer.
   */
  function replace(result: AdminResult<PluginView>): void {
    if (!result.ok) {
      toasts.push(result.message, 'error');
      return;
    }
    reviewing = null;
    plugins = plugins.map((existing) =>
      existing.id === result.value.id ? result.value : existing
    );
  }

  /**
   * Applies the staged upgrade the Review dialog shows.
   */
  async function applyUpgrade(): Promise<void> {
    const plugin = reviewing;
    if (plugin === null) {
      return;
    }
    reviewBusy = true;
    replace(await applyPluginUpgrade(plugin.id));
    reviewBusy = false;
  }

  /**
   * Discards the staged upgrade the Review dialog shows.
   */
  async function declineUpgrade(): Promise<void> {
    const plugin = reviewing;
    if (plugin === null) {
      return;
    }
    reviewBusy = true;
    replace(await declinePluginUpgrade(plugin.id));
    reviewBusy = false;
  }

  /**
   * Enables or disables one plugin.
   *
   * @param plugin The plugin to switch.
   */
  async function toggle(plugin: PluginView): Promise<void> {
    replace(await setPluginEnabled(plugin.id, plugin.state !== 'enabled'));
  }

  /** Removes the plugin the confirmation shows. */
  async function removeSelectedPlugin(): Promise<void> {
    const plugin = removingPlugin;
    if (plugin === null) {
      return;
    }
    removing = true;
    const result = await removePlugin(plugin.id);
    removing = false;
    if (!result.ok) {
      toasts.push(result.message, 'error');
      return;
    }
    plugins = plugins.filter((existing) => existing.id !== plugin.id);
    removingPlugin = null;
  }

  /**
   * Presents the repository dialog for one registered repository.
   *
   * @param repository The repository to change.
   */
  function editRepository(repository: RepositoryView): void {
    editingRepository = repository;
  }

  /** Reloads the page after the dialog saved a repository. */
  function repositorySaved(): void {
    editingRepository = null;
    void load();
  }

  /** Removes the repository the confirmation shows. */
  async function removeSelectedRepository(): Promise<void> {
    const repository = removingRepository;
    if (repository === null) {
      return;
    }
    removing = true;
    const result = await removeRepository(repository.id);
    removing = false;
    if (!result.ok) {
      toasts.push(result.message, 'error');
      return;
    }
    removingRepository = null;
    await load();
  }
</script>

<svelte:head>
  <title>Plugins - Hearthsound</title>
</svelte:head>

{#snippet actions()}
  <Button
    variant="suggested"
    header
    icon="adwaita-add"
    label="Add Plugins"
    onclick={() => (adding = true)}
  >
    Add Plugins
  </Button>
{/snippet}

{#snippet retryAction()}
  <Button onclick={() => void load()}>Retry</Button>
{/snippet}

<PageHeader title="Plugins" class="admin-header" onnavigation={shell?.openNavigation} {actions} />

<div class="content">
  {#each indexErrors as error (error)}
    <Banner level="warning" text={error} />
  {/each}

  {#if failure !== null}
    <StatusPage
      level={2}
      alert
      icon="adwaita-error"
      title="Could Not Load This Page"
      text="The server did not answer. Try again in a moment."
      action={retryAction}
    />
  {:else}
    <InstalledPlugins
      {plugins}
      {loading}
      ontoggle={(plugin) => void toggle(plugin)}
      onreview={(plugin) => (reviewing = plugin)}
      onremove={(plugin) => (removingPlugin = plugin)}
    />

    <AvailablePlugins
      plugins={offered}
      {loading}
      {installing}
      oninstall={(plugin) => void install(plugin)}
    />

    <Repositories
      {repositories}
      {loading}
      onedit={editRepository}
      onremove={(repository) => (removingRepository = repository)}
    />
  {/if}
</div>

{#if adding}
  <AddPluginsDialog onclose={() => (adding = false)} onsubmit={added} />
{/if}

{#if reviewing !== null && reviewing.upgrade !== null && reviewing.upgrade !== undefined}
  {@const upgrade = reviewing.upgrade}
  <Dialog title="Review {reviewing.name}" onclose={() => (reviewing = null)}>
    <p>
      Version {upgrade.version} asks for permissions version {reviewing.version} does not hold. The installed
      version keeps running until you apply it.
    </p>
    <div class="hs-settings-group">
      <PermissionList permissions={upgrade.newPermissions} />
    </div>

    {#snippet footer()}
      <Button disabled={reviewBusy} onclick={() => void declineUpgrade()}>Decline Upgrade</Button>
      <Button variant="suggested" busy={reviewBusy} onclick={() => void applyUpgrade()}>
        Apply Upgrade
      </Button>
    {/snippet}
  </Dialog>
{/if}

{#if editingRepository !== null}
  <RepositoryDialog
    repository={editingRepository}
    onclose={() => (editingRepository = null)}
    onsaved={repositorySaved}
  />
{/if}

{#if removingPlugin !== null}
  <Dialog
    title="Remove Plugin?"
    alert
    onclose={() => (removingPlugin = null)}
    description={`${removingPlugin.name} and its permissions and assignments are removed.`}
  >
    <span aria-hidden="true"></span>

    {#snippet footer()}
      <Button disabled={removing} onclick={() => (removingPlugin = null)}>Cancel</Button>
      <Button
        variant="destructive"
        busy={removing}
        disabled={removing}
        onclick={() => void removeSelectedPlugin()}
      >
        Remove
      </Button>
    {/snippet}
  </Dialog>
{/if}

{#if removingRepository !== null}
  <Dialog
    title="Remove Repository?"
    alert
    onclose={() => (removingRepository = null)}
    description={`${removingRepository.name ?? removingRepository.url} is no longer checked for plugins.`}
  >
    <span aria-hidden="true"></span>

    {#snippet footer()}
      <Button disabled={removing} onclick={() => (removingRepository = null)}>Cancel</Button>
      <Button
        variant="destructive"
        busy={removing}
        disabled={removing}
        onclick={() => void removeSelectedRepository()}
      >
        Remove
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

  /* Layout glue only: p24 puts the groups under the header and leaves the page
     28 px at the bottom, with 16 px between a group and the next heading. */
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    padding-block: 0 var(--hs-space-7);
  }
</style>
