<!--
  The fields of one provider instance: the plugin it is configured from, its
  slug, the name shown in the admin UI, the configuration the plugin's manifest
  declares, and the host settings that say where the instance may read and
  write and how many calls it may run at once.

  The plugin's own configuration is a form rendered from its schema; the import
  roots are the administrator's, not the plugin's, so the plugin only ever
  names a root by its id.
-->
<script lang="ts">
  import JsonForm from '#lib/jsonforms/JsonForm.svelte';

  import { defaultSlug, formConfig, IMPORT_MODES, uniqueSlug } from './providers';
  import type { ImportRoot, ProviderFields } from './providers';
  import type { PluginView } from './plugins';

  /** Props of the fields. */
  interface Props {
    /** The fields of the instance, edited in place. */
    fields: ProviderFields;
    /** The installed plugins an instance can be configured from. */
    plugins: PluginView[];
    /** The slugs the server already has, which a new instance may not reuse. */
    takenSlugs: string[];
    /** Whether the plugin and the slug are fixed, as they are on an edit. */
    editing?: boolean;
  }

  let { fields = $bindable(), plugins, takenSlugs, editing = false }: Props = $props();

  const plugin = $derived(plugins.find((entry) => entry.id === fields.pluginId) ?? null);
  const config = $derived(formConfig(plugin?.config));
  const readsFiles = $derived(plugin?.provides.includes('acquisition') === true);

  /**
   * Configures a new instance from the chosen plugin.
   *
   * @param event The change of the plugin list.
   */
  function choosePlugin(event: Event): void {
    const pluginId = (event.currentTarget as HTMLSelectElement).value;
    fields.pluginId = pluginId;
    if (editing) {
      return;
    }
    const chosen = plugins.find((entry) => entry.id === pluginId) ?? null;
    fields.displayName = chosen?.name ?? '';
    fields.slug = uniqueSlug(defaultSlug(pluginId), takenSlugs);
  }

  /** Adds an import root the plugin may name. */
  function addRoot(): void {
    fields.hostConfig = {
      ...fields.hostConfig,
      importRoots: [
        ...fields.hostConfig.importRoots,
        { id: '', path: '', mode: 'move', readOnly: false }
      ]
    };
  }

  /**
   * Changes one import root.
   *
   * @param index The root's position in the table.
   * @param change The fields to replace.
   */
  function changeRoot(index: number, change: Partial<ImportRoot>): void {
    const importRoots = fields.hostConfig.importRoots.map((root, position) =>
      position === index ? { ...root, ...change } : root
    );
    fields.hostConfig = { ...fields.hostConfig, importRoots };
  }

  /**
   * Removes one import root.
   *
   * @param index The root's position in the table.
   */
  function removeRoot(index: number): void {
    fields.hostConfig = {
      ...fields.hostConfig,
      importRoots: fields.hostConfig.importRoots.filter((_, position) => position !== index)
    };
  }
</script>

<div class="fields">
  <label class="field">
    <span class="field-label">Plugin</span>
    <select class="input" value={fields.pluginId} disabled={editing} onchange={choosePlugin}>
      {#if plugin === null}
        <option value="">Choose a plugin</option>
      {/if}
      {#each plugins as entry (entry.id)}
        <option value={entry.id}>{entry.name}</option>
      {/each}
    </select>
  </label>

  <label class="field">
    <span class="field-label">Slug</span>
    <input class="input" bind:value={fields.slug} disabled={editing} />
    <span class="field-hint">
      The name this instance is named by, 2 to 24 lowercase letters and digits.
    </span>
  </label>

  <label class="field">
    <span class="field-label">Display name</span>
    <input class="input" bind:value={fields.displayName} />
  </label>

  {#if config !== null}
    <div class="configuration">
      <h3 class="section-title">Configuration</h3>
      <JsonForm
        schema={config.schema}
        uischema={config.uischema}
        data={fields.serverConfig}
        onchange={(data) => (fields.serverConfig = data)}
      />
    </div>
  {/if}

  {#if readsFiles}
    <div class="host">
      <h3 class="section-title">Files</h3>
      <table class="roots">
        <thead>
          <tr>
            <th scope="col">Id</th>
            <th scope="col">Path</th>
            <th scope="col">Mode</th>
            <th scope="col">Read-only</th>
            <th scope="col"><span class="visually-hidden">Commands</span></th>
          </tr>
        </thead>
        <tbody>
          {#each fields.hostConfig.importRoots as root, index (index)}
            <tr>
              <td>
                <input
                  class="input"
                  aria-label="Root id"
                  value={root.id}
                  oninput={(event) => changeRoot(index, { id: event.currentTarget.value })}
                />
              </td>
              <td>
                <input
                  class="input"
                  aria-label="Root path"
                  value={root.path}
                  oninput={(event) => changeRoot(index, { path: event.currentTarget.value })}
                />
              </td>
              <td>
                <select
                  class="input"
                  aria-label="Root mode"
                  value={root.mode}
                  onchange={(event) => changeRoot(index, { mode: event.currentTarget.value })}
                >
                  {#each IMPORT_MODES as mode (mode)}
                    <option value={mode}>{mode}</option>
                  {/each}
                </select>
              </td>
              <td>
                <input
                  type="checkbox"
                  aria-label="Root is read-only"
                  checked={root.readOnly}
                  onchange={(event) => changeRoot(index, { readOnly: event.currentTarget.checked })}
                />
              </td>
              <td>
                <button type="button" onclick={() => removeRoot(index)}>Remove</button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
      <p class="field-hint">
        A file left in an import root is moved, copied or linked into the library when it is
        imported.
      </p>
      <button type="button" onclick={addRoot}>Add import root</button>

      <details class="advanced">
        <summary>Advanced</summary>
        <label class="field">
          <span class="field-hint">Calls at once</span>
          <input class="input" type="number" min="0" bind:value={fields.hostConfig.maxConcurrent} />
        </label>
        <label class="field">
          <span class="field-hint">Searches at once</span>
          <input
            class="input"
            type="number"
            min="0"
            bind:value={fields.hostConfig.maxConcurrentSearches}
          />
        </label>
        <label class="field">
          <span class="field-hint">Searches per hour</span>
          <input
            class="input"
            type="number"
            min="0"
            bind:value={fields.hostConfig.searchesPerHour}
          />
        </label>
      </details>
    </div>
  {/if}
</div>

<style>
  .fields {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-label,
  .section-title {
    font-weight: 600;
  }

  .section-title {
    margin: 0 0 var(--space-2);
    font-size: 1rem;
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

  .configuration,
  .host {
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .roots {
    width: 100%;
    margin-bottom: var(--space-2);
    border-collapse: collapse;
  }

  .roots th,
  .roots td {
    padding: var(--space-1);
    text-align: left;
    border-bottom: var(--border-width) solid var(--color-border);
  }

  .roots th {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .roots button,
  .host > button {
    padding: var(--space-1) var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .advanced {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin-top: var(--space-3);
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
