<!--
  The configuration step: one instance per plugin the administrator checked.

  The fields are the ones the provider dialog renders - the name, the slug, the
  configuration the plugin's manifest describes and the host settings - and a
  plugin that already has an instance is shown with it, so the wizard changes
  what serves instead of configuring a second one. Adding the import roots of a
  plugin that fetches files is part of the same form.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import ProviderFields from '#lib/admin/ProviderFields.svelte';
  import { problemMessage } from '#lib/admin/problem';
  import { newProviderBody, providerPatchBody } from '#lib/admin/providers';
  import type { PluginView } from '#lib/admin/plugins';
  import { nativeClient } from '#lib/api/native';
  import { configureTargets } from '#lib/setup/steps';
  import type { SetupConfigureTarget } from '#lib/setup/steps';

  /** One plugin to configure, with the plugins its fields may choose from. */
  interface Target extends SetupConfigureTarget {
    /** The plugin, as the fields component takes the plugins to configure from. */
    plugins: PluginView[];
  }

  /** Props of the step. */
  interface Props {
    /** The plugin ids the administrator checked. */
    selection: string[];
    /** Moves on to the next step. */
    oncontinue: () => void;
  }

  let { selection, oncontinue }: Props = $props();

  let targets = $state<Target[]>([]);
  let taken = $state<string[]>([]);
  let failures = $state<Record<string, string>>({});
  let failure = $state<string | null>(null);
  let busy = $state<string | null>(null);

  onMount(async () => {
    const [installed, providers] = await Promise.all([
      nativeClient.GET('/api/v1/admin/plugins'),
      nativeClient.GET('/api/v1/admin/providers')
    ]);
    if (installed.data === undefined) {
      failure = problemMessage(installed.error, 'Could not load the plugins.');
      return;
    }
    const configured = providers.data?.providers ?? [];
    taken = configured.map((provider) => provider.slug);
    targets = configureTargets(selection, installed.data.plugins, configured).map((target) => ({
      ...target,
      plugins: [target.plugin]
    }));
  });

  /**
   * Adds the instance the fields describe, or changes the one that exists.
   *
   * @param target The plugin being configured.
   */
  async function save(target: Target): Promise<void> {
    const id = target.plugin.id;
    busy = id;
    const answer =
      target.provider === null
        ? await nativeClient.POST('/api/v1/admin/providers', {
            body: newProviderBody(target.fields)
          })
        : await nativeClient.PATCH('/api/v1/admin/providers/{slug}', {
            params: { path: { slug: target.provider.slug } },
            body: providerPatchBody(target.fields)
          });
    busy = null;
    if (answer.data === undefined) {
      failures = {
        ...failures,
        [id]: problemMessage(answer.error, 'Could not save the instance.')
      };
      return;
    }
    const saved = answer.data;
    targets = targets.map((existing) =>
      existing.plugin.id === id ? { ...existing, provider: saved } : existing
    );
    const cleared = { ...failures };
    delete cleared[id];
    failures = cleared;
  }
</script>

<section class="step">
  <h2>Configure</h2>
  <p>
    Each plugin serves through an instance: the name it is listed under and its own configuration. A
    plugin that fetches files also names the directories it may read and write, which are the
    administrator's to set.
  </p>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  {#each targets as target (target.plugin.id)}
    <section class="instance">
      <h3>{target.plugin.name}</h3>
      <p class="hint">
        {target.plugin.id}{target.provider === null
          ? ' - not configured yet'
          : ` - in service as ${target.provider.slug}`}
      </p>

      <ProviderFields
        bind:fields={target.fields}
        plugins={target.plugins}
        takenSlugs={taken}
        editing={target.provider !== null}
      />

      {#if failures[target.plugin.id] !== undefined}
        <p class="failure" role="alert">{failures[target.plugin.id]}</p>
      {/if}

      <div class="commands">
        <button
          class="primary"
          type="button"
          onclick={() => save(target)}
          disabled={busy === target.plugin.id}
        >
          {target.provider === null ? 'Add instance' : 'Save changes'}
        </button>
      </div>
    </section>
  {/each}

  {#if targets.length === 0 && failure === null}
    <p class="hint">No plugin was checked, so there is nothing to configure.</p>
  {/if}

  <div class="commands">
    <button class="primary" type="button" onclick={oncontinue}>Continue</button>
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

  .step p {
    margin: 0;
  }

  .instance {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .instance h3 {
    margin: 0;
    font-size: 1rem;
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
