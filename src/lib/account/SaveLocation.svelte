<!--
  The save location (UR4, decision 21).

  One row: the managed library or one of the scanned folders this account owns.
  The group is drawn only for an account that owns at least one scanned folder;
  an account with none has nothing to choose between, so the account page shows
  no heading for it either. The choice saves the moment it changes, like every
  other setting row, and a refused save restores the choice the row showed and
  says why under it.

  Usage: `<SaveLocation />`
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import { listSaveFolders, readSaveFolder, writeSaveFolder } from '#lib/account/library';
  import type { MyFolderView } from '#lib/account/library';
  import Select from '#lib/ui/Select.svelte';
  import type { SelectOption } from '#lib/ui/Select.svelte';

  /** The value of the managed library, which is not a folder id. */
  const MANAGED = '';

  /** What the row chose and what the server stored, in the picker's values. */
  const MANAGED_OPTION: SelectOption = { value: MANAGED, label: 'Managed library' };

  let folders = $state<MyFolderView[]>([]);
  let chosen = $state(MANAGED);
  let loading = $state(true);
  let busy = $state(false);
  /** The problem a refused save answered with, shown under the row. */
  let failure = $state<string | null>(null);

  /** The choices: the managed library, then the folders the account owns. */
  const options = $derived<SelectOption[]>([
    MANAGED_OPTION,
    ...folders.map((folder) => ({ value: folder.id, label: folder.name }))
  ]);

  onMount(() => {
    void load();
  });

  /** Reads the account's folders and the stored choice. */
  async function load(): Promise<void> {
    loading = true;
    const [folderResult, storedResult] = await Promise.all([listSaveFolders(), readSaveFolder()]);
    loading = false;
    if (!folderResult.ok) {
      return;
    }
    folders = folderResult.value;
    const stored = storedResult.ok ? storedResult.value : null;
    // A folder that was deleted or reassigned since the save falls back to the
    // managed library on the server, so the control never shows a value it does
    // not offer.
    chosen = stored !== null && folders.some((folder) => folder.id === stored) ? stored : MANAGED;
  }

  /**
   * Stores the choice the reader made.
   *
   * @param value The chosen option's value.
   */
  async function choose(value: string): Promise<void> {
    const previous = chosen;
    chosen = value;
    failure = null;
    busy = true;
    try {
      const result = await writeSaveFolder(value === MANAGED ? null : value);
      if (!result.ok) {
        chosen = previous;
        failure = result.message;
      }
    } finally {
      busy = false;
    }
  }
</script>

{#if !loading && folders.length > 0}
  <section class="account-group" aria-label="Save Location">
    <h2 class="hs-title-4">Save Location</h2>
    <div class="hs-settings-group group">
      <div class="hs-setting-row hs-setting-row--two-line">
        <span class="hs-setting-row__text">
          <span class="title">Save location</span>
          <span class="hs-setting-row__subtitle">Where music you save is written.</span>
          {#if failure !== null}
            <span class="hs-setting-row__subtitle failure" role="alert">{failure}</span>
          {/if}
        </span>
        <Select
          label="Save location"
          value={chosen}
          {options}
          disabled={busy}
          onchange={(value) => void choose(value)}
        />
      </div>
    </div>
  </section>
{/if}

<style>
  .title {
    font-weight: 600;
  }

  .failure {
    color: var(--hs-error);
  }
</style>
