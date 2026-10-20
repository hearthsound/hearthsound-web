<!--
  The configuration step: one instance per plugin the administrator checked.

  Each row shows the plugin, whether it is configured yet, and the command that
  opens the instance dialog: "Add instance" for a plugin without one, "Edit"
  for a plugin that already serves. The dialog holds the same fields as the
  admin instance dialog - the plugin, the slug, the configuration the plugin's
  manifest describes and the host settings - and is the 640 px exception.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import ProviderForm from '#lib/admin/ProviderForm.svelte';
  import { problemMessage } from '#lib/admin/problem';
  import type { PluginView } from '#lib/admin/plugins';
  import { nativeClient } from '#lib/api/native';
  import { configureTargets } from '#lib/setup/steps';
  import type { SetupConfigureTarget } from '#lib/setup/steps';

  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import SetupFooter from './SetupFooter.svelte';

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
    /** Moves back to the previous step. */
    onback?: () => void;
  }

  let { selection, oncontinue, onback }: Props = $props();

  let targets = $state<Target[]>([]);
  let taken = $state<string[]>([]);
  let editing = $state<Target | null>(null);
  let failure = $state<string | null>(null);

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
   * Replaces the row's instance with the one the server answered with.
   *
   * @param saved The instance.
   */
  function saved(saved: NonNullable<Target['provider']>): void {
    const pluginId = editing?.plugin.id;
    editing = null;
    if (pluginId === undefined) {
      return;
    }
    if (!taken.includes(saved.slug)) {
      taken = [...taken, saved.slug];
    }
    targets = targets.map((target) =>
      target.plugin.id === pluginId ? { ...target, provider: saved } : target
    );
  }
</script>

<section class="hs-form">
  <div class="hs-setup">
    <h2 class="hs-title-3 step-title">Configure</h2>
    <p class="step-lead">
      Each plugin serves through an instance: the name it is listed under and its own configuration.
      A plugin that fetches files also names the directories it may read and write, which is the
      administrator's to set.
    </p>

    {#if failure !== null}
      <Banner level="error" text={failure} />
    {/if}

    {#if targets.length === 0 && failure === null}
      <p class="hs-setting-row__subtitle">
        No plugin was checked, so there is nothing to configure.
      </p>
    {:else}
      <div class="hs-settings-group">
        {#each targets as target (target.plugin.id)}
          <div class="hs-setting-row hs-setting-row--two-line">
            <span class="hs-setting-row__text">
              <span>{target.plugin.name}</span>
              <span class="hs-setting-row__subtitle">
                {target.plugin.id}{target.provider === null
                  ? ' - not configured yet'
                  : ` - in service as ${target.provider.slug}`}
              </span>
            </span>
            <Button onclick={() => (editing = target)}>
              {target.provider === null ? 'Add instance' : 'Edit'}
            </Button>
          </div>
        {/each}
      </div>
    {/if}

    <SetupFooter {onback}>
      <Button variant="suggested" onclick={oncontinue}>Continue</Button>
    </SetupFooter>
  </div>
</section>

{#if editing !== null}
  <ProviderForm
    provider={editing.provider}
    plugins={editing.plugins}
    takenSlugs={taken}
    onclose={() => (editing = null)}
    onsaved={saved}
  />
{/if}

<style>
  .step-title,
  .step-lead {
    margin: 0;
  }
</style>
