<!--
  The fields of one provider instance: the plugin it is configured from, its
  slug, the name shown in the admin UI, the configuration the plugin's manifest
  declares, and the host settings that say where the instance may read and
  write and how many calls it may run at once.

  The plugin's own configuration is a form rendered from its schema; the import
  roots are the administrator's, not the plugin's, so the plugin only ever
  names a root by its id. The rows of the Files group are the p05 import-root
  rows; the Advanced expander holds the three k04 numbers.
-->
<script lang="ts">
  import JsonForm from '#lib/jsonforms/JsonForm.svelte';
  import Button from '#lib/ui/Button.svelte';
  import Checkbox from '#lib/ui/Checkbox.svelte';
  import FormField from '#lib/ui/FormField.svelte';
  import ListRow from '#lib/ui/ListRow.svelte';
  import NumberField from '#lib/ui/NumberField.svelte';
  import Select from '#lib/ui/Select.svelte';
  import TextField from '#lib/ui/TextField.svelte';

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

  const uid = $props.id();
  const pluginId = $derived(`plugin-${uid}`);
  const slugId = $derived(`slug-${uid}`);
  const displayNameId = $derived(`display-name-${uid}`);

  const plugin = $derived(plugins.find((entry) => entry.id === fields.pluginId) ?? null);
  const config = $derived(formConfig(plugin?.config));
  const readsFiles = $derived(plugin?.provides.includes('acquisition') === true);

  const pluginOptions = $derived([
    ...(plugin === null ? [{ value: '', label: 'Choose a plugin' }] : []),
    ...plugins.map((entry) => ({ value: entry.id, label: entry.name }))
  ]);

  const modeOptions = $derived(IMPORT_MODES.map((mode) => ({ value: mode, label: mode })));

  let advanced = $state(false);

  /**
   * Configures a new instance from the chosen plugin.
   *
   * @param chosen The plugin id the drop-down reported.
   */
  function choosePlugin(chosen: string): void {
    fields.pluginId = chosen;
    if (editing) {
      return;
    }
    const selected = plugins.find((entry) => entry.id === chosen) ?? null;
    fields.displayName = selected?.name ?? '';
    fields.slug = uniqueSlug(defaultSlug(chosen), takenSlugs);
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

<div class="hs-form">
  <FormField label="Plugin" for={pluginId}>
    <Select
      id={pluginId}
      label="Plugin"
      options={pluginOptions}
      value={fields.pluginId}
      disabled={editing}
      onchange={choosePlugin}
    />
  </FormField>

  <FormField
    label="Slug"
    for={slugId}
    hint="The name this instance is named by, 2 to 24 lowercase letters and digits."
  >
    <TextField id={slugId} bind:value={fields.slug} disabled={editing} />
  </FormField>

  <FormField label="Display name" for={displayNameId}>
    <TextField id={displayNameId} bind:value={fields.displayName} />
  </FormField>

  {#if config !== null}
    <div class="section">
      <h3 class="hs-heading">Configuration</h3>
      <JsonForm
        schema={config.schema}
        uischema={config.uischema}
        data={fields.serverConfig}
        onchange={(data) => (fields.serverConfig = data)}
      />
    </div>
  {/if}

  {#if readsFiles}
    <div class="section">
      <h3 class="hs-heading">Files</h3>

      <div class="hs-import-roots">
        {#each fields.hostConfig.importRoots as root, index (index)}
          <div class="hs-import-root">
            <div class="hs-field hs-import-root__id">
              <input
                class="hs-field__input"
                aria-label="Root id"
                value={root.id}
                oninput={(event) => changeRoot(index, { id: event.currentTarget.value })}
              />
            </div>
            <div class="hs-field hs-import-root__path">
              <input
                class="hs-field__input"
                aria-label="Root path"
                value={root.path}
                oninput={(event) => changeRoot(index, { path: event.currentTarget.value })}
              />
            </div>
            <div class="hs-import-root__mode">
              <Select
                label="Root mode"
                options={modeOptions}
                value={root.mode}
                onchange={(mode) => changeRoot(index, { mode })}
              />
            </div>
            <Checkbox
              label="Read-only"
              aria-label="Root is read-only"
              checked={root.readOnly}
              onchange={(readOnly) => changeRoot(index, { readOnly })}
            />
            <Button
              shape="icon"
              variant="flat"
              icon="adwaita-delete"
              label="Remove"
              onclick={() => removeRoot(index)}
            />
          </div>
        {/each}

        <ListRow title="Add import root" button icon="adwaita-add" onclick={addRoot} />
      </div>

      <p class="hs-import-roots__hint">
        A file left in an import root is moved, copied or linked into the library when it is
        imported.
      </p>
    </div>

    <div>
      <ListRow
        title="Advanced"
        expander
        interactive
        expanded={advanced}
        onclick={() => (advanced = !advanced)}
      />
      {#if advanced}
        <div class="advanced">
          <FormField label="Calls at once">
            <NumberField
              label="Calls at once"
              min={0}
              bind:value={fields.hostConfig.maxConcurrent}
            />
          </FormField>
          <FormField label="Searches at once">
            <NumberField
              label="Searches at once"
              min={0}
              bind:value={fields.hostConfig.maxConcurrentSearches}
            />
          </FormField>
          <FormField label="Searches per hour">
            <NumberField
              label="Searches per hour"
              min={0}
              bind:value={fields.hostConfig.searchesPerHour}
            />
          </FormField>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .section {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
  }

  .section > .hs-heading {
    margin: 0;
  }

  .advanced {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-5);
    padding: var(--hs-space-5) 0 0;
  }
</style>
