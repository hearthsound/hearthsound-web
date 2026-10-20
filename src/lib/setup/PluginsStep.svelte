<!--
  The plugins step: the plugins that serve the three layers the wizard offers.

  Every plugin the server hosts and every one the reachable indexes offer is
  listed under the layer it provides, checked where the server ships it, with
  the permissions it asks for and the risk each grant carries. Continuing puts
  the checked plugins in service: a plugin that is missing is installed and
  then approved, which is one action because installing is the approval; a
  plugin that is off is switched on again. A plugin that fails is reported in
  place and the rest are run anyway.

  One "Add Plugins" row opens the chooser: the Repository tab registers an
  index, the File tab installs an archive. Both reload the list. The shipped
  plugins are checked the first time the step is opened; an administrator who
  unchecks them keeps that choice when walking back and forth.
-->
<script module>
  /** Whether the default selection was offered; the steps remount as they are walked. */
  let seeded = false;
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  import PluginPermissions from '#lib/admin/PluginPermissions.svelte';
  import { formatBytes } from '#lib/admin/bytes';
  import { problemMessage } from '#lib/admin/problem';
  import { riskLabel } from '#lib/admin/plugins';
  import { nativeClient } from '#lib/api/native';
  import {
    defaultSelection,
    outcomeText,
    pluginEntries,
    pluginPlan,
    runPluginPlan,
    SETUP_LAYERS
  } from '#lib/setup/steps';
  import type {
    SetupPluginCall,
    SetupPluginEntry,
    SetupPluginOutcome,
    SetupPluginPlanEntry
  } from '#lib/setup/steps';

  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Checkbox from '#lib/ui/Checkbox.svelte';
  import Dialog from '#lib/ui/Dialog.svelte';
  import DropZone from '#lib/ui/DropZone.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import ListRow from '#lib/ui/ListRow.svelte';
  import Pill from '#lib/ui/Pill.svelte';
  import Segmented from '#lib/ui/Segmented.svelte';
  import TextArea from '#lib/ui/TextArea.svelte';
  import TextField from '#lib/ui/TextField.svelte';
  import SetupFooter from './SetupFooter.svelte';

  /** Props of the step. */
  interface Props {
    /** The plugin ids the administrator checked, kept while walking the steps. */
    selection: string[];
    /** Moves on to the next step. */
    oncontinue: () => void;
    /** Moves back to the previous step. */
    onback?: () => void;
  }

  let { selection = $bindable(), oncontinue, onback }: Props = $props();

  const addUid = $props.id();
  const urlId = $derived(`repository-url-${addUid}`);
  const nameId = $derived(`repository-name-${addUid}`);
  const keyId = $derived(`repository-key-${addUid}`);
  const addFormId = $derived(`add-plugins-${addUid}`);

  let entries = $state<SetupPluginEntry[]>([]);
  let indexErrors = $state<string[]>([]);
  let outcomes = $state<SetupPluginOutcome[] | null>(null);
  let plan = $state<SetupPluginPlanEntry[]>([]);
  let expanded = $state<string[]>([]);
  let failure = $state<string | null>(null);
  let busy = $state(false);
  let retrying = $state<string | null>(null);

  let addOpen = $state(false);
  let addTab = $state<'repository' | 'file'>('repository');
  let repositoryUrl = $state('');
  let repositoryName = $state('');
  let repositoryKey = $state('');
  let queryRepository = $state(true);
  let archive = $state<File | null>(null);
  let addFailure = $state<string | null>(null);
  let addBusy = $state(false);

  const groups = $derived(
    SETUP_LAYERS.map((name) => ({
      name,
      label: name.charAt(0).toUpperCase() + name.slice(1),
      entries: entries.filter((entry) => entry.layer === name)
    })).filter((group) => group.entries.length > 0)
  );

  const tabs = [
    { value: 'repository', label: 'Repository' },
    { value: 'file', label: 'File' }
  ];

  /** The pill each risk is drawn with. */
  const RISKS = {
    low: { tone: 'success', glyph: 'adwaita-check' },
    medium: { tone: 'warning', glyph: 'adwaita-warning' },
    high: { tone: 'error', glyph: 'adwaita-error' }
  } as const;

  onMount(async () => {
    await loadPlugins();
    if (!seeded) {
      seeded = true;
      selection = defaultSelection(entries);
    }
  });

  /** Reads the installed plugins and what the indexes offer. */
  async function loadPlugins(): Promise<void> {
    const [installed, available] = await Promise.all([
      nativeClient.GET('/api/v1/admin/plugins'),
      nativeClient.GET('/api/v1/admin/plugins/available')
    ]);
    if (installed.data === undefined) {
      failure = problemMessage(installed.error, 'Could not load the plugins.');
      return;
    }
    failure = null;
    entries = pluginEntries(installed.data.plugins, available.data?.plugins ?? []);
    indexErrors = (available.data?.errors ?? []).map((error) => `${error.source}: ${error.detail}`);
  }

  /**
   * Returns the highest risk among a plugin's grants.
   *
   * @param entry The plugin.
   * @returns The risk, or `null` when it asks for nothing or its grants are not
   *   known before installing.
   */
  function highestRisk(entry: SetupPluginEntry): 'low' | 'medium' | 'high' | null {
    const permissions = entry.installed?.requestedPermissions ?? [];
    if (permissions.some((permission) => permission.risk === 'high')) {
      return 'high';
    }
    if (permissions.some((permission) => permission.risk === 'medium')) {
      return 'medium';
    }
    if (permissions.some((permission) => permission.risk === 'low')) {
      return 'low';
    }
    return null;
  }

  /**
   * Checks or unchecks one plugin.
   *
   * @param entry The plugin to toggle.
   */
  function toggle(entry: SetupPluginEntry): void {
    selection = selection.includes(entry.id)
      ? selection.filter((id) => id !== entry.id)
      : [...selection, entry.id];
  }

  /**
   * Opens or closes one plugin's details.
   *
   * @param id The plugin's id.
   */
  function toggleDetails(id: string): void {
    expanded = expanded.includes(id) ? expanded.filter((open) => open !== id) : [...expanded, id];
  }

  /** Clears the add dialog's fields. */
  function resetAdd(): void {
    addTab = 'repository';
    repositoryUrl = '';
    repositoryName = '';
    repositoryKey = '';
    queryRepository = true;
    archive = null;
    addFailure = null;
  }

  /** Shows the add dialog with empty fields. */
  function openAdd(): void {
    resetAdd();
    addOpen = true;
  }

  /** Closes the add dialog. */
  function closeAdd(): void {
    addOpen = false;
    resetAdd();
  }

  /**
   * Returns the calls the plugin plan makes.
   *
   * Installing a plugin and approving it are one action: the browser calls
   * install, then the current approve endpoint, under one busy state.
   *
   * @returns The install, approve and enable calls.
   */
  function pluginApi(): {
    install: (entry: SetupPluginPlanEntry) => Promise<SetupPluginCall>;
    approve: (entry: SetupPluginPlanEntry) => Promise<SetupPluginCall>;
    enable: (entry: SetupPluginPlanEntry) => Promise<SetupPluginCall>;
  } {
    return {
      install: async (entry) => {
        const answer = await nativeClient.POST('/api/v1/admin/plugins', {
          body:
            entry.repositoryId === null
              ? { source: 'index', pluginId: entry.id }
              : { source: 'index', pluginId: entry.id, repositoryId: entry.repositoryId }
        });
        return answer.data === undefined
          ? { ok: false, error: problemMessage(answer.error, 'Could not install the plugin.') }
          : { ok: true };
      },
      approve: async (entry) => {
        const answer = await nativeClient.POST('/api/v1/admin/plugins/{id}/approve', {
          params: { path: { id: entry.id } }
        });
        return answer.data === undefined
          ? { ok: false, error: problemMessage(answer.error, 'Could not approve the plugin.') }
          : { ok: true };
      },
      enable: async (entry) => {
        const answer = await nativeClient.POST('/api/v1/admin/plugins/{id}/enable', {
          params: { path: { id: entry.id } }
        });
        return answer.data === undefined
          ? { ok: false, error: problemMessage(answer.error, 'Could not enable the plugin.') }
          : { ok: true };
      }
    };
  }

  /**
   * Puts the checked plugins in service and moves on.
   *
   * The first press runs the plan; a run whose plugins all answered moves on by
   * itself, and one that reported a failure stays so the administrator can read
   * it and continue anyway.
   */
  async function proceed(): Promise<void> {
    if (outcomes !== null) {
      oncontinue();
      return;
    }
    busy = true;
    plan = pluginPlan(selection, entries);
    const results = await runPluginPlan(plan, pluginApi());
    busy = false;
    outcomes = results;
    if (results.every((outcome) => outcome.error === null)) {
      oncontinue();
    }
  }

  /**
   * Runs one failed plugin's plan again.
   *
   * @param outcome The outcome whose row asked to retry.
   */
  async function retry(outcome: SetupPluginOutcome): Promise<void> {
    const entry = plan.find((candidate) => candidate.id === outcome.id);
    if (entry === undefined || outcomes === null) {
      return;
    }
    retrying = outcome.id;
    const [result] = await runPluginPlan([entry], pluginApi());
    retrying = null;
    if (result === undefined) {
      return;
    }
    outcomes = outcomes.map((existing) => (existing.id === result.id ? result : existing));
  }

  /**
   * Adds the repository or installs the archive the add dialog holds.
   *
   * @param event The form submission.
   */
  async function addSubmit(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    addFailure = null;
    addBusy = true;
    try {
      if (addTab === 'repository') {
        const answer = await nativeClient.POST('/api/v1/admin/plugin-repositories', {
          body: {
            url: repositoryUrl.trim(),
            name: repositoryName.trim() === '' ? null : repositoryName.trim(),
            publicKey: repositoryKey.trim() === '' ? null : repositoryKey.trim()
          }
        });
        if (answer.data === undefined) {
          addFailure = problemMessage(answer.error, 'Could not save the repository.');
          return;
        }
        if (!queryRepository) {
          const patch = await nativeClient.PATCH('/api/v1/admin/plugin-repositories/{id}', {
            params: { path: { id: answer.data.id } },
            body: { enabled: false }
          });
          if (patch.data === undefined) {
            addFailure = problemMessage(patch.error, 'Could not save the repository.');
            await loadPlugins();
            return;
          }
        }
      } else {
        const chosen = archive;
        if (chosen === null) {
          return;
        }
        const body = new FormData();
        body.append('file', chosen);
        const answer = await nativeClient.POST('/api/v1/admin/plugins/upload', { body });
        if (answer.data === undefined) {
          addFailure = problemMessage(answer.error, 'Could not install the file.');
          return;
        }
        const approved = await nativeClient.POST('/api/v1/admin/plugins/{id}/approve', {
          params: { path: { id: answer.data.id } }
        });
        if (approved.data === undefined) {
          addFailure = problemMessage(approved.error, 'Could not approve the plugin.');
          await loadPlugins();
          return;
        }
      }
      await loadPlugins();
      addOpen = false;
    } finally {
      addBusy = false;
    }
  }

  /**
   * Keeps the first file a drop or the picker answered with.
   *
   * @param files The files.
   */
  function chooseArchive(files: FileList): void {
    const [first] = files;
    if (first !== undefined) {
      archive = first;
    }
  }
</script>

<section class="hs-form">
  <div class="hs-setup">
    <h2 class="hs-title-3 step-title">Plugins</h2>
    <p class="step-lead">
      Plugins look up metadata, search for music and fetch files that are not on the server. The
      ones Hearthsound ships with are checked; add or remove any you like. Each one shows what it
      asks for and the risk each grant carries.
      <a class="hs-link" href="https://hearthsound.app/docs/plugins/">Learn more about plugins</a>
    </p>

    {#if failure !== null}
      <Banner level="error" text={failure} />
    {/if}

    {#if indexErrors.length > 0}
      <Banner level="warning" role="alert">
        {#each indexErrors as error (error)}
          <span>{error}</span>
        {/each}
      </Banner>
    {/if}

    <div class="groups">
      {#each groups as group (group.name)}
        <div class="group">
          <h3 class="hs-group-heading">{group.label}</h3>

          <div class="hs-settings-group">
            {#each group.entries as entry (entry.id)}
              {@const risk = highestRisk(entry)}
              {@const open = expanded.includes(entry.id)}
              <div class="hs-setting-row plugin-row">
                <Checkbox
                  label=""
                  aria-label={entry.name}
                  checked={selection.includes(entry.id)}
                  onchange={() => toggle(entry)}
                />
                <button
                  class="plugin-toggle hs-setting-row--expander"
                  type="button"
                  aria-label={entry.name}
                  aria-expanded={open}
                  onclick={() => toggleDetails(entry.id)}
                >
                  <span class="hs-setting-row__text">
                    <span>{entry.name}</span>
                    <span class="hs-setting-row__subtitle">
                      {entry.id} - provides {entry.layers.join(', ')}{entry.isDefault
                        ? ' - shipped with Hearthsound'
                        : ''}
                    </span>
                    {#if entry.description !== null}
                      <span class="hs-setting-row__subtitle">{entry.description}</span>
                    {/if}
                  </span>
                  {#if risk !== null}
                    <Pill
                      tone={RISKS[risk].tone}
                      glyph={RISKS[risk].glyph}
                      label={riskLabel(risk)}
                    />
                  {/if}
                  <Icon name="adwaita-expand" class="hs-setting-row__icon" />
                </button>
              </div>

              {#if open}
                <div class="hs-setting-row plugin-details">
                  <div class="plugin-detail">
                    {#if entry.installed !== null}
                      <PluginPermissions plugin={entry.installed} />
                    {:else}
                      <p class="hs-setting-row__subtitle">
                        Its permissions are shown once it is installed.
                      </p>
                    {/if}
                  </div>
                </div>
              {/if}
            {/each}
          </div>
        </div>
      {/each}

      <div class="hs-settings-group">
        <ListRow title="Add Plugins" button icon="adwaita-add" onclick={openAdd} />
      </div>
    </div>

    {#if outcomes !== null}
      <div class="hs-settings-group outcomes">
        {#each outcomes as outcome (outcome.id)}
          <div class="hs-setting-row">
            <Icon
              name={outcome.error === null ? 'adwaita-check' : 'adwaita-error'}
              class="hs-setting-row__icon {outcome.error === null
                ? 'hs-setting-row__icon--success'
                : 'hs-setting-row__icon--error'}"
            />
            <span class="hs-setting-row__text">
              <span>{outcome.name}</span>
              <span
                class="hs-setting-row__subtitle"
                class:hs-setting-row__subtitle--error={outcome.error !== null}
                role={outcome.error === null ? undefined : 'alert'}
              >
                {outcomeText(outcome)}
              </span>
            </span>
            {#if outcome.error !== null}
              <Button disabled={retrying === outcome.id} onclick={() => retry(outcome)}
                >Retry</Button
              >
            {/if}
          </div>
        {/each}
      </div>
    {:else if entries.length === 0 && failure === null}
      <p class="hs-setting-row__subtitle">Nothing to install yet.</p>
    {/if}

    <SetupFooter {onback}>
      <Button variant="suggested" {busy} onclick={proceed}>
        {outcomes === null ? 'Install and continue' : 'Continue anyway'}
      </Button>
    </SetupFooter>
  </div>
</section>

{#if addOpen}
  {#snippet addFooter()}
    <Button onclick={closeAdd}>Cancel</Button>
    <Button variant="suggested" type="submit" form={addFormId} busy={addBusy}>
      {addTab === 'repository' ? 'Add Repository' : 'Install File'}
    </Button>
  {/snippet}

  <Dialog title="Add Plugins" onclose={closeAdd} footer={addFooter}>
    <form id={addFormId} class="hs-form" onsubmit={addSubmit}>
      <Segmented
        label="Add Plugins"
        segments={tabs}
        value={addTab}
        onchange={(chosen) => (addTab = chosen === 'file' ? 'file' : 'repository')}
      />

      {#if addTab === 'repository'}
        <p>A repository lists more plugins; they appear under Available.</p>

        <FormField label="URL" for={urlId} hint="The URL of the repository's index document.">
          <TextField id={urlId} kind="url" bind:value={repositoryUrl} required />
        </FormField>

        <FormField label="Name" for={nameId} optional>
          <TextField id={nameId} bind:value={repositoryName} />
        </FormField>

        <FormField
          label="Public key"
          for={keyId}
          optional
          hint="The minisign key the index is signed with; empty reads the index unsigned."
        >
          <TextArea id={keyId} bind:value={repositoryKey} />
        </FormField>

        <Checkbox label="Query this repository" bind:checked={queryRepository} />
      {:else}
        <p>Install a plugin from an archive file on this computer.</p>

        <DropZone
          small
          icon="adwaita-plugin"
          label="Plugin archive"
          hint="Drop the archive here, or choose it."
          buttonLabel="Choose file"
          accept=".hsplugin"
          multiple={false}
          suggested={false}
          onfiles={chooseArchive}
        />

        {#if archive !== null}
          <div class="hs-setting-row hs-setting-row--two-line">
            <Icon name="adwaita-plugin" class="hs-setting-row__icon" />
            <span class="hs-setting-row__text">
              <span>{archive.name}</span>
              <span class="hs-setting-row__subtitle">{formatBytes(archive.size)}</span>
            </span>
            <Button
              shape="icon"
              variant="flat"
              icon="adwaita-close"
              label="Remove"
              onclick={() => (archive = null)}
            />
          </div>
        {/if}

        <!-- plugin-approval-interim: the File tab shows the chosen archive's
             PermissionList here once the server reports permissions for
             uninstalled plugins; until then Install File installs and approves
             directly and no permission list is shown. -->
      {/if}

      {#if addFailure !== null}
        <Banner level="error" text={addFailure} />
      {/if}
    </form>
  </Dialog>
{/if}

<style>
  .step-title,
  .step-lead {
    margin: 0;
  }

  .groups {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
  }

  .hs-group-heading {
    margin: var(--hs-space-4) 0 0;
  }

  .plugin-row {
    align-items: flex-start;
  }

  .plugin-toggle {
    display: flex;
    flex: 1;
    align-items: center;
    gap: var(--hs-space-4);
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: default;
  }

  .plugin-detail {
    flex: 1;
    min-width: 0;
  }

  .plugin-details {
    padding-left: var(--hs-space-8);
  }

  .outcomes {
    margin-top: var(--hs-space-2);
  }
</style>
