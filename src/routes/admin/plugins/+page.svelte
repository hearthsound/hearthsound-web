<!--
  The plugins of the server.

  Installed lists what is hosted here with its state and the commands that
  approve, enable, upgrade and remove it; Available lists what the reachable
  indexes offer and installs from them; Repositories manages where those
  indexes are read from; Upload takes a plugin archive from this computer.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import Dialog from '#lib/admin/Dialog.svelte';
  import PluginPermissions from '#lib/admin/PluginPermissions.svelte';
  import { pluginStateLabel, sourceLabel } from '#lib/admin/plugins';
  import type { AvailablePluginView, PluginView, RepositoryView } from '#lib/admin/plugins';
  import { problemMessage } from '#lib/admin/problem';
  import { nativeClient } from '#lib/api/native';
  import { toasts } from '#lib/stores/toasts.svelte';

  /** Which list the page shows. */
  type Tab = 'installed' | 'available' | 'repositories' | 'upload';

  let tab = $state<Tab>('installed');
  let plugins = $state<PluginView[]>([]);
  let available = $state<AvailablePluginView[]>([]);
  let indexErrors = $state<string[]>([]);
  let repositories = $state<RepositoryView[]>([]);
  let failure = $state<string | null>(null);
  let reviewing = $state<PluginView | null>(null);
  let editingRepository = $state<RepositoryDraft | null>(null);
  let file = $state<File | null>(null);
  let busy = $state(false);

  /** The fields of the repository dialog. */
  interface RepositoryDraft {
    /** The repository's client id, or `null` when it is being registered. */
    id: string | null;
    /** The URL of its index document. */
    url: string;
    /** The name shown to administrators. */
    name: string;
    /** The minisign public key its index is signed with. */
    publicKey: string;
    /** Whether the repository is queried for its index. */
    enabled: boolean;
  }

  onMount(() => {
    void loadInstalled();
    void loadAvailable();
    void loadRepositories();
  });

  /** Loads the installed plugins. */
  async function loadInstalled(): Promise<void> {
    const answer = await nativeClient.GET('/api/v1/admin/plugins');
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not load the plugins.');
      return;
    }
    failure = null;
    plugins = answer.data.plugins;
  }

  /** Loads what the reachable indexes offer. */
  async function loadAvailable(): Promise<void> {
    const answer = await nativeClient.GET('/api/v1/admin/plugins/available');
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not load what the indexes offer.');
      return;
    }
    available = answer.data.plugins;
    indexErrors = answer.data.errors.map((error) => `${error.source}: ${error.detail}`);
  }

  /** Loads the registered repositories. */
  async function loadRepositories(): Promise<void> {
    const answer = await nativeClient.GET('/api/v1/admin/plugin-repositories');
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not load the repositories.');
      return;
    }
    repositories = answer.data.repositories;
  }

  /**
   * Replaces one installed plugin with the state the server reported.
   *
   * @param plugin The plugin as it is now.
   */
  function replace(plugin: PluginView): void {
    reviewing = null;
    plugins = plugins.map((existing) => (existing.id === plugin.id ? plugin : existing));
  }

  /**
   * Approves the plugin the review dialog shows.
   */
  async function approveReviewed(): Promise<void> {
    const plugin = reviewing;
    if (plugin === null) {
      return;
    }
    await act(`/api/v1/admin/plugins/{id}/approve`, plugin, 'Could not approve the plugin.');
  }

  /**
   * Applies the staged upgrade of one plugin.
   *
   * @param plugin The plugin to upgrade.
   */
  async function applyUpgrade(plugin: PluginView): Promise<void> {
    await act(`/api/v1/admin/plugins/{id}/approve`, plugin, 'Could not apply the upgrade.');
  }

  /**
   * Discards the staged upgrade of one plugin.
   *
   * @param plugin The plugin whose upgrade is declined.
   */
  async function declineUpgrade(plugin: PluginView): Promise<void> {
    await act(
      `/api/v1/admin/plugins/{id}/decline-upgrade`,
      plugin,
      'Could not decline the upgrade.'
    );
  }

  /**
   * Enables one approved plugin.
   *
   * @param plugin The plugin to enable.
   */
  async function enable(plugin: PluginView): Promise<void> {
    await act(`/api/v1/admin/plugins/{id}/enable`, plugin, 'Could not enable the plugin.');
  }

  /**
   * Disables one approved plugin.
   *
   * @param plugin The plugin to disable.
   */
  async function disable(plugin: PluginView): Promise<void> {
    await act(`/api/v1/admin/plugins/{id}/disable`, plugin, 'Could not disable the plugin.');
  }

  /**
   * Runs one plugin command on one plugin and replaces it with the answer.
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
    replace(answer.data);
  }

  /**
   * Removes one plugin with its files and permissions.
   *
   * @param plugin The plugin to remove.
   */
  async function remove(plugin: PluginView): Promise<void> {
    if (!window.confirm(`Remove ${plugin.name}? Its permissions and assignments go with it.`)) {
      return;
    }
    const answer = await nativeClient.DELETE('/api/v1/admin/plugins/{id}', {
      params: { path: { id: plugin.id } }
    });
    if (answer.response.status !== 204) {
      toasts.push(problemMessage(answer.error, 'Could not remove the plugin.'), 'error');
      return;
    }
    plugins = plugins.filter((existing) => existing.id !== plugin.id);
  }

  /**
   * Installs one plugin an index offers.
   *
   * @param plugin The plugin to install.
   */
  async function install(plugin: AvailablePluginView): Promise<void> {
    const repositoryId = plugin.repositoryId ?? null;
    const answer = await nativeClient.POST('/api/v1/admin/plugins', {
      body:
        repositoryId === null
          ? { source: 'index', pluginId: plugin.id }
          : { source: 'index', pluginId: plugin.id, repositoryId }
    });
    if (answer.data === undefined) {
      toasts.push(problemMessage(answer.error, 'Could not install the plugin.'), 'error');
      return;
    }
    toasts.push(`Installed ${plugin.name}. Approve its permissions to switch it on.`);
    await loadInstalled();
    await loadAvailable();
  }

  /**
   * Presents the repository dialog for a new repository.
   */
  function addRepository(): void {
    editingRepository = { id: null, url: '', name: '', publicKey: '', enabled: true };
  }

  /**
   * Presents the repository dialog for one registered repository.
   *
   * @param repository The repository to change.
   */
  function editRepository(repository: RepositoryView): void {
    editingRepository = {
      id: repository.id,
      url: repository.url,
      name: repository.name ?? '',
      publicKey: repository.publicKey ?? '',
      enabled: repository.enabled
    };
  }

  /**
   * Registers or changes the repository the dialog shows.
   *
   * @param event The form submission.
   */
  async function saveRepository(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    const draft = editingRepository;
    if (draft === null) {
      return;
    }
    busy = true;
    const answer =
      draft.id === null
        ? await nativeClient.POST('/api/v1/admin/plugin-repositories', {
            body: {
              url: draft.url.trim(),
              name: draft.name.trim() === '' ? null : draft.name.trim(),
              publicKey: draft.publicKey.trim() === '' ? null : draft.publicKey.trim()
            }
          })
        : await nativeClient.PATCH('/api/v1/admin/plugin-repositories/{id}', {
            params: { path: { id: draft.id } },
            body: {
              name: draft.name.trim() === '' ? null : draft.name.trim(),
              publicKey: draft.publicKey.trim() === '' ? null : draft.publicKey.trim(),
              enabled: draft.enabled
            }
          });
    busy = false;
    if (answer.data === undefined) {
      toasts.push(problemMessage(answer.error, 'Could not save the repository.'), 'error');
      return;
    }
    editingRepository = null;
    await loadRepositories();
    await loadAvailable();
  }

  /**
   * Removes one repository.
   *
   * @param repository The repository to remove.
   */
  async function removeRepository(repository: RepositoryView): Promise<void> {
    if (!window.confirm(`Remove ${repository.name ?? repository.url}?`)) {
      return;
    }
    const answer = await nativeClient.DELETE('/api/v1/admin/plugin-repositories/{id}', {
      params: { path: { id: repository.id } }
    });
    if (answer.response.status !== 204) {
      toasts.push(problemMessage(answer.error, 'Could not remove the repository.'), 'error');
      return;
    }
    await loadRepositories();
    await loadAvailable();
  }

  /** Uploads the chosen plugin archive. */
  async function upload(): Promise<void> {
    const chosen = file;
    if (chosen === null) {
      return;
    }
    busy = true;
    const body = new FormData();
    body.append('file', chosen);
    const answer = await nativeClient.POST('/api/v1/admin/plugins/upload', { body });
    busy = false;
    if (answer.data === undefined) {
      toasts.push(problemMessage(answer.error, 'Could not install the file.'), 'error');
      return;
    }
    file = null;
    toasts.push(`Installed ${answer.data.name}. Approve its permissions to switch it on.`);
    await loadInstalled();
  }
</script>

<svelte:head>
  <title>Plugins - Hearthsound</title>
</svelte:head>

<section class="page">
  <header class="header">
    <h1>Plugins</h1>
    <div class="tabs">
      <button type="button" aria-pressed={tab === 'installed'} onclick={() => (tab = 'installed')}>
        Installed
      </button>
      <button type="button" aria-pressed={tab === 'available'} onclick={() => (tab = 'available')}>
        Available
      </button>
      <button
        type="button"
        aria-pressed={tab === 'repositories'}
        onclick={() => (tab = 'repositories')}
      >
        Repositories
      </button>
      <button type="button" aria-pressed={tab === 'upload'} onclick={() => (tab = 'upload')}>
        Upload
      </button>
    </div>
  </header>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  {#if tab === 'installed'}
    <table class="table">
      <thead>
        <tr>
          <th scope="col">Plugin</th>
          <th scope="col">Version</th>
          <th scope="col">State</th>
          <th scope="col">Source</th>
          <th scope="col"><span class="visually-hidden">Commands</span></th>
        </tr>
      </thead>
      <tbody>
        {#each plugins as plugin (plugin.id)}
          <tr>
            <td>
              <span class="name">{plugin.name}</span>
              <span class="slug">{plugin.id}</span>
            </td>
            <td>{plugin.version}</td>
            <td><span class="state state-{plugin.state}">{pluginStateLabel(plugin.state)}</span></td
            >
            <td>{sourceLabel(plugin.source)}</td>
            <td class="commands">
              {#if plugin.state === 'pending-approval' || plugin.state === 'upgrade-pending-approval'}
                <button type="button" onclick={() => (reviewing = plugin)}
                  >Review and approve</button
                >
              {/if}
              {#if plugin.state === 'upgrade-pending-approval'}
                <button type="button" onclick={() => applyUpgrade(plugin)}>Apply upgrade</button>
                <button type="button" onclick={() => declineUpgrade(plugin)}>Decline upgrade</button
                >
              {/if}
              {#if plugin.state === 'enabled'}
                <button type="button" onclick={() => disable(plugin)}>Disable</button>
              {/if}
              {#if plugin.state === 'disabled'}
                <button type="button" onclick={() => enable(plugin)}>Enable</button>
              {/if}
              <button type="button" onclick={() => remove(plugin)}>Remove</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if plugins.length === 0}
      <p class="hint">No plugins installed yet.</p>
    {/if}
  {:else if tab === 'available'}
    {#each indexErrors as error (error)}
      <p class="hint" role="alert">{error}</p>
    {/each}

    <table class="table">
      <thead>
        <tr>
          <th scope="col">Plugin</th>
          <th scope="col">Version</th>
          <th scope="col">Provides</th>
          <th scope="col"><span class="visually-hidden">Commands</span></th>
        </tr>
      </thead>
      <tbody>
        {#each available as plugin (plugin.id)}
          <tr>
            <td>
              <span class="name">{plugin.name}</span>
              <span class="slug">{plugin.id}</span>
              <p class="hint">{plugin.description}</p>
            </td>
            <td>{plugin.version ?? 'unknown'}</td>
            <td>{plugin.provides.join(', ')}</td>
            <td class="commands">
              <div>
                <button
                  type="button"
                  disabled={plugin.unavailable !== null && plugin.unavailable !== undefined}
                  onclick={() => install(plugin)}
                >
                  Install
                </button>
              </div>
              {#if plugin.unavailable !== null && plugin.unavailable !== undefined}
                <p class="hint">{plugin.unavailable.detail}</p>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if available.length === 0}
      <p class="hint">No index offered a plugin.</p>
    {/if}
  {:else if tab === 'repositories'}
    <div class="commands">
      <button type="button" onclick={addRepository}>Add repository</button>
    </div>

    <table class="table">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">URL</th>
          <th scope="col">Verified</th>
          <th scope="col">Queried</th>
          <th scope="col"><span class="visually-hidden">Commands</span></th>
        </tr>
      </thead>
      <tbody>
        {#each repositories as repository (repository.id)}
          <tr>
            <td>{repository.name ?? '-'}</td>
            <td class="slug">{repository.url}</td>
            <td>{repository.verified ? 'Signed' : 'Read unsigned'}</td>
            <td>{repository.enabled ? 'Yes' : 'No'}</td>
            <td class="commands">
              <div>
                <button type="button" onclick={() => editRepository(repository)}>Edit</button>
                <button type="button" onclick={() => removeRepository(repository)}>Delete</button>
              </div>
              {#if repository.lastError !== null && repository.lastError !== undefined}
                <p class="hint">{repository.lastError}</p>
              {/if}
            </td>
          </tr>
        {/each}
      </tbody>
    </table>

    {#if repositories.length === 0}
      <p class="hint">Only the official index is read.</p>
    {/if}
  {:else}
    <div class="upload">
      <p class="hint">Install a plugin from an archive file on this computer.</p>
      <input
        class="input"
        type="file"
        accept=".hsplugin"
        aria-label="Plugin archive"
        onchange={(event) => (file = event.currentTarget.files?.[0] ?? null)}
      />
      <button type="button" onclick={upload} disabled={file === null || busy}>Install file</button>
    </div>
  {/if}
</section>

{#if reviewing !== null}
  <Dialog title="Review and approve {reviewing.name}" onclose={() => (reviewing = null)}>
    <PluginPermissions plugin={reviewing} />
    <div class="commands">
      <button type="button" class="primary" onclick={approveReviewed}>
        {reviewing.state === 'upgrade-pending-approval' ? 'Apply upgrade' : 'Approve'}
      </button>
      <button type="button" onclick={() => (reviewing = null)}>Cancel</button>
    </div>
  </Dialog>
{/if}

{#if editingRepository !== null}
  <Dialog
    title={editingRepository.id === null ? 'Add repository' : 'Edit repository'}
    onclose={() => (editingRepository = null)}
  >
    <form class="form" onsubmit={saveRepository}>
      <label class="field">
        <span class="field-label">URL</span>
        <input
          class="input"
          bind:value={editingRepository.url}
          disabled={editingRepository.id !== null}
          required
        />
        <span class="field-hint">The URL of the repository's index document.</span>
      </label>

      <label class="field">
        <span class="field-label">Name</span>
        <input class="input" bind:value={editingRepository.name} />
      </label>

      <label class="field">
        <span class="field-label">Public key</span>
        <input class="input" bind:value={editingRepository.publicKey} />
        <span class="field-hint">
          The minisign key the index is signed with; empty reads the index unsigned.
        </span>
      </label>

      {#if editingRepository.id !== null}
        <label class="checkbox">
          <input type="checkbox" bind:checked={editingRepository.enabled} />
          <span>Query this repository</span>
        </label>
      {/if}

      <div class="commands">
        <button class="primary" type="submit" disabled={busy}>
          {editingRepository.id === null ? 'Add repository' : 'Save changes'}
        </button>
        <button type="button" onclick={() => (editingRepository = null)}>Cancel</button>
      </div>
    </form>
  </Dialog>
{/if}

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

  .tabs {
    display: flex;
    gap: var(--space-1);
  }

  .tabs button {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .tabs button[aria-pressed='true'] {
    color: var(--color-accent-fg);
    background: var(--color-accent);
    border-color: var(--color-accent);
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

  .slug {
    display: block;
    color: var(--color-fg-muted);
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }

  .state {
    padding: 0 var(--space-1);
    font-size: 0.875rem;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .state-pending-approval,
  .state-upgrade-pending-approval {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  .state-disabled {
    color: var(--color-fg-muted);
  }

  .commands {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    justify-content: flex-end;
  }

  .commands div {
    display: flex;
    gap: var(--space-1);
  }

  .commands button,
  .commands > button {
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

  .commands button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .commands button.primary {
    color: var(--color-accent-fg);
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-label {
    font-weight: 600;
  }

  .field-hint {
    margin: 0;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .input {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .input:disabled {
    color: var(--color-fg-muted);
    background: var(--color-bg-sunken);
  }

  .checkbox {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .upload {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    align-items: flex-start;
  }

  .upload button {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
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
