<!--
  The plugins step: the plugins that serve the three layers the wizard offers.

  Every plugin the server hosts and every one the reachable indexes offer is
  listed under the layer it provides, checked where the server ships it, with
  the permissions it asks for and the risk each grant carries. Continuing
  installs the ones that are missing, approves the ones waiting for approval and
  switches on the ones that are off; a plugin that fails is reported in place
  and the rest are run anyway.

  The shipped plugins are checked the first time the step is opened; an
  administrator who unchecks them keeps that choice when walking back and forth.
-->
<script module>
  /** Whether the default selection was offered; the steps remount as they are walked. */
  let seeded = false;
</script>

<script lang="ts">
  import { onMount } from 'svelte';

  import PluginPermissions from '#lib/admin/PluginPermissions.svelte';
  import { problemMessage } from '#lib/admin/problem';
  import { nativeClient } from '#lib/api/native';
  import {
    defaultSelection,
    outcomeText,
    pluginEntries,
    pluginPlan,
    runPluginPlan,
    SETUP_LAYERS
  } from '#lib/setup/steps';
  import type { SetupPluginEntry, SetupPluginOutcome } from '#lib/setup/steps';

  /** Props of the step. */
  interface Props {
    /** The plugin ids the administrator checked, kept while walking the steps. */
    selection: string[];
    /** Moves on to the next step. */
    oncontinue: () => void;
  }

  let { selection = $bindable(), oncontinue }: Props = $props();

  let entries = $state<SetupPluginEntry[]>([]);
  let indexErrors = $state<string[]>([]);
  let outcomes = $state<SetupPluginOutcome[] | null>(null);
  let failure = $state<string | null>(null);
  let busy = $state(false);

  const groups = $derived(
    SETUP_LAYERS.map((name) => ({
      name,
      entries: entries.filter((entry) => entry.layer === name)
    })).filter((group) => group.entries.length > 0)
  );

  onMount(async () => {
    const [installed, available] = await Promise.all([
      nativeClient.GET('/api/v1/admin/plugins'),
      nativeClient.GET('/api/v1/admin/plugins/available')
    ]);
    if (installed.data === undefined) {
      failure = problemMessage(installed.error, 'Could not load the plugins.');
      return;
    }
    entries = pluginEntries(installed.data.plugins, available.data?.plugins ?? []);
    indexErrors = (available.data?.errors ?? []).map((error) => `${error.source}: ${error.detail}`);
    if (!seeded) {
      seeded = true;
      selection = defaultSelection(entries);
    }
  });

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
    const results = await runPluginPlan(pluginPlan(selection, entries), {
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
    });
    busy = false;
    outcomes = results;
    if (results.every((outcome) => outcome.error === null)) {
      oncontinue();
    }
  }
</script>

<section class="step">
  <h2>Plugins</h2>
  <p>
    Plugins look up metadata, search for music and fetch files that are not on the server. The ones
    Hearthsound ships with are checked; add or remove any you like. Each one shows what it asks for
    and the risk each grant carries.
  </p>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  {#each indexErrors as error (error)}
    <p class="hint" role="alert">{error}</p>
  {/each}

  {#each groups as group (group.name)}
    <div class="group">
      <h3>{group.name}</h3>

      <ul class="plugins">
        {#each group.entries as entry (entry.id)}
          <li class="plugin">
            <label class="choice">
              <input
                type="checkbox"
                checked={selection.includes(entry.id)}
                onchange={() => toggle(entry)}
              />
              <span class="name">{entry.name}</span>
            </label>

            <p class="hint">
              {entry.id} - provides {entry.layers.join(', ')}{entry.isDefault
                ? ' - shipped with Hearthsound'
                : ''}
            </p>

            {#if entry.description !== null}
              <p class="hint">{entry.description}</p>
            {/if}

            {#if entry.installed !== null}
              <PluginPermissions plugin={entry.installed} />
            {:else}
              <p class="hint">Its permissions are shown once it is installed.</p>
            {/if}
          </li>
        {/each}
      </ul>
    </div>
  {/each}

  {#if entries.length === 0 && failure === null}
    <p class="hint">No plugin is installed or offered, so there is nothing to check.</p>
  {/if}

  {#if outcomes !== null}
    <ul class="outcomes">
      {#each outcomes as outcome (outcome.id)}
        <li class:failed={outcome.error !== null}>
          <span class="name">{outcome.name}</span>
          <span class="hint" role={outcome.error !== null ? 'alert' : undefined}>
            {outcomeText(outcome)}
          </span>
        </li>
      {/each}
    </ul>
  {/if}

  <div class="commands">
    <button class="primary" type="button" onclick={proceed} disabled={busy}>
      {outcomes === null ? 'Install and continue' : 'Continue anyway'}
    </button>
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
    text-transform: capitalize;
  }

  .step p {
    margin: 0;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .plugins {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .plugin {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .choice {
    display: flex;
    gap: var(--space-2);
    align-items: baseline;
    cursor: pointer;
  }

  .name {
    font-weight: 600;
  }

  .outcomes {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .outcomes li {
    display: flex;
    gap: var(--space-2);
  }

  .outcomes .failed {
    color: var(--color-danger);
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

  .commands button:disabled {
    opacity: 0.6;
    cursor: default;
  }
</style>
