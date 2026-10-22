<!--
  The plugins of the server (p24 C, p24-r1, p24-r3, k28, k34).

  One page of headed groups: Installed lists what is hosted here with its state
  and the commands that switch it off, review its staged upgrade or remove it;
  Available lists what the reachable indexes offer and installs from them;
  Repositories manages where those indexes are read from. Installing is
  approval: Install and Install File call the install endpoint and the current
  approve endpoint as one action, so no plugin waits for an approval step. The
  Add Plugins dialog holds the Repository and File tabs.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import type { IconName } from '@hearthsound/design/icons';

  import AddPluginsDialog from '#lib/admin/AddPluginsDialog.svelte';
  import type { AddPluginsRequest } from '#lib/admin/AddPluginsDialog.svelte';
  import { pluginStateLabel, sourceLabel } from '#lib/admin/plugins';
  import type { AvailablePluginView, PluginView, RepositoryView } from '#lib/admin/plugins';
  import { problemMessage } from '#lib/admin/problem';
  import { nativeClient } from '#lib/api/native';
  import { getShellNavigation } from '#lib/shell-navigation';
  import { toasts } from '#lib/stores/toasts.svelte';
  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Checkbox from '#lib/ui/Checkbox.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import type { PillTone } from '#lib/ui/Pill.svelte';
  import Skeleton from '#lib/ui/Skeleton.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';
  import TextArea from '#lib/ui/TextArea.svelte';
  import TextField from '#lib/ui/TextField.svelte';

  /** The fields of the repository dialog. */
  interface RepositoryDraft {
    /** The repository's client id. */
    id: string;
    /** The title the dialog opened with: the name it had, or its URL. */
    title: string;
    /** The URL of its index document, fixed once registered. */
    url: string;
    /** The name shown to administrators. */
    name: string;
    /** The minisign public key its index is signed with. */
    publicKey: string;
    /** Whether the repository is queried for its index. */
    enabled: boolean;
  }

  const shell = getShellNavigation();
  const repositoryFormId = $props.id();

  let plugins = $state<PluginView[]>([]);
  let available = $state<AvailablePluginView[]>([]);
  let indexErrors = $state<string[]>([]);
  let repositories = $state<RepositoryView[]>([]);
  let failure = $state<string | null>(null);
  let loading = $state(true);
  let adding = $state(false);
  let reviewing = $state<PluginView | null>(null);
  let editingRepository = $state<RepositoryDraft | null>(null);
  let removingPlugin = $state<PluginView | null>(null);
  let removingRepository = $state<RepositoryView | null>(null);
  let removing = $state(false);
  let installing = $state<string | null>(null);
  let reviewBusy = $state(false);

  onMount(() => {
    void load();
  });

  /**
   * The pill one lifecycle state is drawn with.
   *
   * @param state The state the server reported.
   * @returns The tone and glyph; the neutral unknown pill for a state this
   *   client does not know.
   */
  function statePill(state: string): { tone: PillTone; glyph: IconName } {
    switch (state) {
      case 'enabled':
        return { tone: 'success', glyph: 'adwaita-check' };
      case 'disabled':
        return { tone: 'neutral', glyph: 'adwaita-remove' };
      case 'upgrade-pending-approval':
        return { tone: 'warning', glyph: 'adwaita-warning' };
      default:
        return { tone: 'neutral', glyph: 'custom-unknown' };
    }
  }

  /** Loads the installed plugins, the offered ones and the repositories. */
  async function load(): Promise<void> {
    loading = true;
    const [installed, offered, registered] = await Promise.all([
      nativeClient.GET('/api/v1/admin/plugins'),
      nativeClient.GET('/api/v1/admin/plugins/available'),
      nativeClient.GET('/api/v1/admin/plugin-repositories')
    ]);
    loading = false;
    if (installed.data === undefined) {
      failure = problemMessage(installed.error, 'Could not load the plugins.');
      return;
    }
    if (offered.data === undefined) {
      failure = problemMessage(offered.error, 'Could not load the plugins.');
      return;
    }
    if (registered.data === undefined) {
      failure = problemMessage(registered.error, 'Could not load the plugins.');
      return;
    }
    failure = null;
    plugins = installed.data.plugins;
    available = offered.data.plugins;
    indexErrors = offered.data.errors.map((error) => `${error.source}: ${error.detail}`);
    repositories = registered.data.repositories;
  }

  /**
   * Installs one plugin an index offers and enables it at once.
   *
   * Installing is approval, so the install is followed by the current approve
   * endpoint under one busy state; the endpoint keeps its name for staged
   * upgrades (plugin-approval-interim).
   *
   * @param plugin The plugin to install.
   */
  async function install(plugin: AvailablePluginView): Promise<void> {
    installing = plugin.id;
    const repositoryId = plugin.repositoryId ?? null;
    const answer = await nativeClient.POST('/api/v1/admin/plugins', {
      body:
        repositoryId === null
          ? { source: 'index', pluginId: plugin.id }
          : { source: 'index', pluginId: plugin.id, repositoryId }
    });
    if (answer.data === undefined) {
      installing = null;
      toasts.push(problemMessage(answer.error, 'Could not install the plugin.'), 'error');
      return;
    }
    const approved = await nativeClient.POST('/api/v1/admin/plugins/{id}/approve', {
      params: { path: { id: answer.data.id } }
    });
    installing = null;
    if (approved.data === undefined) {
      toasts.push(problemMessage(approved.error, 'Could not approve the plugin.'), 'error');
      await load();
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
    const body = new FormData();
    body.append('file', request.file);
    const answer = await nativeClient.POST('/api/v1/admin/plugins/upload', { body });
    if (answer.data === undefined) {
      return problemMessage(answer.error, 'Could not install the file.');
    }
    const approved = await nativeClient.POST('/api/v1/admin/plugins/{id}/approve', {
      params: { path: { id: answer.data.id } }
    });
    if (approved.data === undefined) {
      await load();
      return problemMessage(approved.error, 'Could not approve the plugin.');
    }
    toasts.push(`${answer.data.name} installed.`);
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
    const answer = await nativeClient.POST('/api/v1/admin/plugin-repositories', {
      body: { url: request.url, name: request.name, publicKey: request.publicKey }
    });
    if (answer.data === undefined) {
      return problemMessage(answer.error, 'Could not save the repository.');
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
   * Runs one plugin command and replaces the plugin with the answer.
   *
   * @param path The command's path.
   * @param plugin The plugin to act on.
   * @param fallback The message to show when the server did not answer.
   */
  async function act(
    path:
      | '/api/v1/admin/plugins/{id}/approve'
      | '/api/v1/admin/plugins/{id}/decline-upgrade'
      | '/api/v1/admin/plugins/{id}/enable'
      | '/api/v1/admin/plugins/{id}/disable',
    plugin: PluginView,
    fallback: string
  ): Promise<void> {
    const answer = await nativeClient.POST(path, { params: { path: { id: plugin.id } } });
    if (answer.data === undefined) {
      toasts.push(problemMessage(answer.error, fallback), 'error');
      return;
    }
    reviewing = null;
    plugins = plugins.map((existing) => (existing.id === answer.data.id ? answer.data : existing));
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
    await act(`/api/v1/admin/plugins/{id}/approve`, plugin, 'Could not apply the upgrade.');
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
    await act(
      `/api/v1/admin/plugins/{id}/decline-upgrade`,
      plugin,
      'Could not decline the upgrade.'
    );
    reviewBusy = false;
  }

  /**
   * Enables or disables one plugin.
   *
   * @param plugin The plugin to switch.
   */
  async function toggle(plugin: PluginView): Promise<void> {
    if (plugin.state === 'enabled') {
      await act(`/api/v1/admin/plugins/{id}/disable`, plugin, 'Could not disable the plugin.');
      return;
    }
    await act(`/api/v1/admin/plugins/{id}/enable`, plugin, 'Could not enable the plugin.');
  }

  /** Removes the plugin the confirmation shows. */
  async function removePlugin(): Promise<void> {
    const plugin = removingPlugin;
    if (plugin === null) {
      return;
    }
    removing = true;
    const answer = await nativeClient.DELETE('/api/v1/admin/plugins/{id}', {
      params: { path: { id: plugin.id } }
    });
    removing = false;
    if (answer.response.status !== 204) {
      toasts.push(problemMessage(answer.error, 'Could not remove the plugin.'), 'error');
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
    editingRepository = {
      id: repository.id,
      title: repository.name ?? repository.url,
      url: repository.url,
      name: repository.name ?? '',
      publicKey: repository.publicKey ?? '',
      enabled: repository.enabled
    };
  }

  /**
   * Saves the repository the dialog shows.
   *
   * @param event The form submission.
   */
  async function saveRepository(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const draft = editingRepository;
    if (draft === null) {
      return;
    }
    const answer = await nativeClient.PATCH('/api/v1/admin/plugin-repositories/{id}', {
      params: { path: { id: draft.id } },
      body: {
        name: draft.name.trim() === '' ? null : draft.name.trim(),
        publicKey: draft.publicKey.trim() === '' ? null : draft.publicKey.trim(),
        enabled: draft.enabled
      }
    });
    if (answer.data === undefined) {
      toasts.push(problemMessage(answer.error, 'Could not save the repository.'), 'error');
      return;
    }
    editingRepository = null;
    await load();
  }

  /** Removes the repository the confirmation shows. */
  async function removeRepository(): Promise<void> {
    const repository = removingRepository;
    if (repository === null) {
      return;
    }
    removing = true;
    const answer = await nativeClient.DELETE('/api/v1/admin/plugin-repositories/{id}', {
      params: { path: { id: repository.id } }
    });
    removing = false;
    if (answer.response.status !== 204) {
      toasts.push(problemMessage(answer.error, 'Could not remove the repository.'), 'error');
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

{#snippet loadingRows()}
  {#each [0, 1, 2] as row (row)}
    <li class="hs-setting-row" aria-hidden="true">
      <span class="hs-setting-row__text">
        <Skeleton width="35%" height="12px" />
        <Skeleton width="65%" height="10px" />
      </span>
    </li>
  {/each}
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
    <h2 class="hs-section-header__title group-heading">Installed</h2>
    <ul class="hs-settings-group group" aria-label="Installed">
      {#each plugins as plugin (plugin.id)}
        {@const pill = statePill(plugin.state)}
        <li class="hs-setting-row hs-setting-row--two-line plugin-row">
          <span class="hs-setting-row__text">
            <span class="name">
              {plugin.name}
              <Pill tone={pill.tone} glyph={pill.glyph} label={pluginStateLabel(plugin.state)} />
            </span>
            <span class="hs-setting-row__subtitle">
              {plugin.id} - version {plugin.version} - from {sourceLabel(plugin.source)}
            </span>
          </span>
          {#if plugin.state === 'upgrade-pending-approval' && plugin.update !== null && plugin.update !== undefined}
            <Button class="review" onclick={() => (reviewing = plugin)}>Review Upgrade</Button>
          {/if}
          <Menu label="More Actions" align="end">
            {#if plugin.enabled}
              <MenuItem
                label="Disable"
                icon="adwaita-remove"
                onselect={() => void toggle(plugin)}
              />
            {:else}
              <MenuItem label="Enable" icon="adwaita-check" onselect={() => void toggle(plugin)} />
            {/if}
            <MenuItem
              label="Remove"
              icon="adwaita-delete"
              destructive
              onselect={() => (removingPlugin = plugin)}
            />
          </Menu>
        </li>
      {/each}

      {#if loading && plugins.length === 0}
        {@render loadingRows()}
      {:else if plugins.length === 0}
        <li class="hs-setting-row">
          <span class="hs-setting-row__text">
            <span class="hs-setting-row__subtitle">Nothing here yet.</span>
          </span>
        </li>
      {/if}
    </ul>

    <h2 class="hs-section-header__title group-heading">Available</h2>
    <ul class="hs-settings-group group" aria-label="Available">
      {#each available as plugin (plugin.id)}
        {@const unavailable = plugin.unavailable ?? null}
        <li class="hs-setting-row hs-setting-row--two-line plugin-row">
          <span class="hs-setting-row__text">
            <span>{plugin.name}</span>
            <span class="hs-setting-row__subtitle">
              {plugin.id} - version {plugin.version ?? '-'} - provides {plugin.provides.join(', ')}
            </span>
            <span class="hs-setting-row__subtitle">{plugin.description}</span>
            {#if unavailable !== null}
              <span class="hs-setting-row__subtitle">{unavailable.detail}</span>
            {/if}
          </span>
          <Button
            disabled={unavailable !== null}
            busy={installing === plugin.id}
            onclick={() => void install(plugin)}
          >
            Install
          </Button>
        </li>
      {/each}

      {#if loading && available.length === 0}
        {@render loadingRows()}
      {:else if available.length === 0}
        <li class="hs-setting-row">
          <span class="hs-setting-row__text">
            <span class="hs-setting-row__subtitle">Nothing here yet.</span>
          </span>
        </li>
      {/if}
    </ul>

    <h2 class="hs-section-header__title group-heading">Repositories</h2>
    <ul class="hs-settings-group group" aria-label="Repositories">
      {#each repositories as repository (repository.id)}
        <li class="hs-setting-row hs-setting-row--two-line plugin-row">
          <span class="hs-setting-row__text">
            <span>{repository.name ?? repository.url}</span>
            <span class="hs-setting-row__subtitle hs-setting-row__subtitle--mono">
              {repository.url}
            </span>
            <span class="hs-setting-row__subtitle">
              {repository.verified ? 'Signed' : 'Read unsigned'}
            </span>
          </span>
          <Menu label="More Actions" align="end">
            <MenuItem
              label="Edit"
              icon="adwaita-edit"
              onselect={() => editRepository(repository)}
            />
            <MenuItem
              label="Delete"
              icon="adwaita-delete"
              destructive
              onselect={() => (removingRepository = repository)}
            />
          </Menu>
        </li>
      {/each}

      {#if loading && repositories.length === 0}
        {@render loadingRows()}
      {:else if repositories.length === 0}
        <li class="hs-setting-row">
          <span class="hs-setting-row__text">
            <span class="hs-setting-row__subtitle">Nothing here yet.</span>
          </span>
        </li>
      {/if}
    </ul>
  {/if}
</div>

{#if adding}
  <AddPluginsDialog onclose={() => (adding = false)} onsubmit={added} />
{/if}

{#if reviewing !== null}
  <Dialog title="Review {reviewing.name}" onclose={() => (reviewing = null)}>
    <p>
      Version {reviewing.update?.version ?? ''} is ready. The installed version {reviewing.version}
      keeps running until you apply it.
    </p>
    <!-- The staged version's new permissions are not reported by the plugin
         view yet; the permission list joins this sentence with the core change
         that reports them. -->

    {#snippet footer()}
      <Button disabled={reviewBusy} onclick={() => void declineUpgrade()}>Decline Upgrade</Button>
      <Button variant="suggested" busy={reviewBusy} onclick={() => void applyUpgrade()}>
        Apply Upgrade
      </Button>
    {/snippet}
  </Dialog>
{/if}

{#if editingRepository !== null}
  <Dialog title={editingRepository.title} onclose={() => (editingRepository = null)}>
    <form id={repositoryFormId} class="hs-form" onsubmit={saveRepository}>
      <FormField label="URL" for="repository-dialog-url">
        <TextField id="repository-dialog-url" kind="url" value={editingRepository.url} disabled />
      </FormField>

      <FormField label="Name" for="repository-dialog-name" optional>
        <TextField id="repository-dialog-name" bind:value={editingRepository.name} />
      </FormField>

      <FormField
        label="Public key"
        for="repository-dialog-key"
        optional
        hint="The minisign key the index is signed with; empty reads the index unsigned."
      >
        <TextArea id="repository-dialog-key" bind:value={editingRepository.publicKey} />
      </FormField>

      <Checkbox label="Query this repository" bind:checked={editingRepository.enabled} />
    </form>

    {#snippet footer()}
      <Button onclick={() => (editingRepository = null)}>Cancel</Button>
      <Button variant="suggested" type="submit" form={repositoryFormId}>Save changes</Button>
    {/snippet}
  </Dialog>
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
        onclick={() => void removePlugin()}
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
        onclick={() => void removeRepository()}
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

  /* Layout glue only: the boards' group heading is 19/750 with a 10 px top
     margin and a -6 px bottom one against the group. The package carries the
     19/750 type on `hs-section-header__title` and no page-group heading class. */
  .group-heading {
    margin: 10px 0 -6px;
  }

  /* An index that could not be read is reported above the Available group,
     since the page's groups have no row state for it (the old view showed the
     same line as a hint). It stays muted: the repository itself is still
     reached, and the line names what failed. */

  /* Layout glue only: p24 caps every group at 760 px. */
  .group {
    max-width: 760px;
  }

  /* The name line of an installed row, with the state pill beside it (p24). */
  .name {
    display: flex;
    flex-wrap: wrap;
    gap: var(--hs-space-2);
    align-items: center;
  }

  /* p24-r1 pins the row menu to the top right on phones and keeps the row's
     text off it; the Review Upgrade button drops to its own line there. */
  @media (max-width: 720px) {
    .plugin-row {
      position: relative;
      flex-wrap: wrap;
      padding-right: 48px;
    }

    .plugin-row > .hs-setting-row__text {
      flex: 1 1 100%;
    }

    .plugin-row > :global(.menu-anchor) {
      position: absolute;
      top: 8px;
      right: 6px;
    }

    .plugin-row > :global(.hs-button.review) {
      margin-top: 4px;
    }
  }
</style>
