<!--
  The configuration step: one instance per plugin the administrator checked.

  Each row shows the plugin, whether it is configured yet, and the command that
  opens the instance dialog: "Add instance" for a plugin without one, "Edit"
  for a plugin that already serves. The dialog holds the same fields as the
  admin instance dialog - the plugin, the slug, the configuration the plugin's
  manifest describes and the host settings - and is the 640 px exception.

  Above the rows, one warning line names every required layer that nothing
  serves yet, so a run may finish while saying what it will be missing; Continue
  stays available either way. An instance list the server refused is reported
  with a Retry instead of being read as an empty one.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import ProviderForm from '#lib/admin/ProviderForm.svelte';
  import { listPlugins } from '#lib/admin/api/plugins';
  import { listProviders } from '#lib/admin/api/providers';
  import type { PluginView } from '#lib/admin/plugins';
  import type { ProviderView } from '#lib/admin/providers';
  import { configureTargets, emptyLayerWarnings } from '#lib/setup/steps';
  import type { SetupConfigureTarget } from '#lib/setup/steps';

  import Banner from '#lib/ui/Banner.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Icon from '#lib/ui/Icon.svelte';
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
  /** Every configured instance, as the layer warnings read them. */
  let providers = $state<ProviderView[]>([]);
  /** Every installed plugin, which names the layers it provides. */
  let plugins = $state<PluginView[]>([]);
  /** Whether both lists were read, so the warnings can be trusted. */
  let listed = $state(false);

  /** The warnings of the required layers nothing serves yet (A-web-admin-11). */
  const warnings = $derived(listed ? emptyLayerWarnings(providers, plugins) : []);

  onMount(() => {
    void load();
  });

  /**
   * Reads the installed plugins and the configured instances.
   *
   * An instance list the server refused is reported with a Retry, and the taken
   * slugs stay unseeded rather than empty: the server still refuses a duplicate
   * slug, so the step says what it could not read instead of pretending the
   * list is empty. The layer warnings wait for a read that answered, because a
   * list the step could not look at is not an empty one.
   */
  async function load(): Promise<void> {
    failure = null;
    const [installed, instances] = await Promise.all([listPlugins(), listProviders()]);
    if (!installed.ok) {
      failure = installed.message;
      return;
    }
    plugins = installed.value;
    const configured = instances.ok ? instances.value : [];
    providers = configured;
    listed = instances.ok;
    if (instances.ok) {
      taken = configured.map((provider) => provider.slug);
    } else {
      failure = instances.message;
    }
    targets = configureTargets(selection, plugins, configured).map((target) => ({
      ...target,
      plugins: [target.plugin]
    }));
  }

  /**
   * Replaces the row's instance with the one the server answered with.
   *
   * @param saved The instance.
   */
  function saved(saved: ProviderView): void {
    const pluginId = editing?.plugin.id;
    editing = null;
    if (pluginId === undefined) {
      return;
    }
    if (!taken.includes(saved.slug)) {
      taken = [...taken, saved.slug];
    }
    providers = providers.some((provider) => provider.slug === saved.slug)
      ? providers.map((provider) => (provider.slug === saved.slug ? saved : provider))
      : [...providers, saved];
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

    {#if warnings.length > 0}
      <div class="hs-settings-group warnings">
        {#each warnings as warning (warning)}
          <p class="hs-setting-row__subtitle warning" role="status">
            <Icon name="adwaita-warning" class="hs-setting-row__icon" />
            {warning}
          </p>
        {/each}
      </div>
    {/if}

    {#if failure !== null}
      <Banner level="error" text={failure}>
        {#snippet actions()}
          <Button onclick={() => void load()}>Retry</Button>
        {/snippet}
      </Banner>
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

  /* A warning line is a row's subtitle with the warning glyph beside it, which
     no package class puts on one line; only the box is set here. */
  .warning {
    display: flex;
    align-items: center;
    gap: var(--hs-space-2);
    margin: 0;
    padding: var(--hs-space-2) var(--hs-space-3);
  }
</style>
