<!--
  The provider dialog: configures one instance from an installed plugin, or
  changes the configuration of one the server already has.

  The plugin and the slug of an existing instance are fixed, because a
  different plugin or slug is a different instance; everything else - the
  display name, the plugin's own configuration and the host settings - is
  replaced by what the form holds.
-->
<script lang="ts">
  import { untrack } from 'svelte';

  import { nativeClient } from '#lib/api/native';

  import Dialog from '#lib/ui/Dialog.svelte';
  import ProviderFields from './ProviderFields.svelte';
  import { problemMessage } from './problem';
  import {
    DEFAULT_HOST_CONFIG,
    instanceFields,
    newProviderBody,
    pluginFields,
    providerPatchBody
  } from './providers';
  import type { ProviderFields as ProviderFieldsValue, ProviderView } from './providers';
  import type { PluginView } from './plugins';

  /** Props of the dialog. */
  interface Props {
    /** The instance to edit, or `null` to configure a new one. */
    provider: ProviderView | null;
    /** The installed plugins an instance can be configured from. */
    plugins: PluginView[];
    /** The slugs the server already has. */
    takenSlugs: string[];
    /** Closes the dialog. */
    onclose: () => void;
    /** Receives the instance the server answered with. */
    onsaved: (provider: ProviderView) => void;
  }

  let { provider, plugins, takenSlugs, onclose, onsaved }: Props = $props();

  const editing = untrack(() => provider !== null);

  let fields = $state<ProviderFieldsValue>(
    untrack(() => (provider === null ? newFields(plugins, takenSlugs) : instanceFields(provider)))
  );
  let failure = $state<string | null>(null);
  let busy = $state(false);

  /**
   * Returns the fields a new instance starts with.
   *
   * @param plugins The installed plugins.
   * @param takenSlugs The slugs the server already has.
   * @returns The fields, configured from the first plugin.
   */
  function newFields(plugins: PluginView[], takenSlugs: string[]): ProviderFieldsValue {
    const first = plugins[0];
    if (first === undefined) {
      return {
        pluginId: '',
        slug: '',
        displayName: '',
        serverConfig: {},
        hostConfig: { ...DEFAULT_HOST_CONFIG, importRoots: [] }
      };
    }
    return pluginFields(first, takenSlugs);
  }

  /**
   * Saves the instance the fields describe.
   *
   * @param event The form submission.
   */
  async function save(event: SubmitEvent): Promise<void> {
    event.preventDefault();
    busy = true;
    const answer =
      provider === null
        ? await nativeClient.POST('/api/v1/admin/providers', { body: newProviderBody(fields) })
        : await nativeClient.PATCH('/api/v1/admin/providers/{slug}', {
            params: { path: { slug: provider.slug } },
            body: providerPatchBody(fields)
          });
    busy = false;
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not save the instance.');
      return;
    }
    onsaved(answer.data);
  }
</script>

<Dialog title={editing ? 'Edit instance' : 'Add instance'} {onclose}>
  <form class="form" onsubmit={save}>
    <ProviderFields bind:fields {plugins} {takenSlugs} {editing} />

    {#if failure !== null}
      <p class="failure" role="alert">{failure}</p>
    {/if}

    <div class="commands">
      <button class="primary" type="submit" disabled={busy}>
        {editing ? 'Save changes' : 'Add instance'}
      </button>
      <button type="button" onclick={onclose}>Cancel</button>
    </div>
  </form>
</Dialog>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
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
