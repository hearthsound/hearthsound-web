<!--
  The server settings.

  Every registered setting is listed under the first segment of its key, with an
  editor that suits its shape and the note that says where its value comes from
  when the configuration file or the environment pins it.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import SettingField from '#lib/admin/SettingField.svelte';
  import { problemMessage } from '#lib/admin/problem';
  import { groupSettings } from '#lib/admin/settings';
  import type { ServerSetting } from '#lib/admin/settings';
  import { nativeClient } from '#lib/api/native';

  let settings = $state<ServerSetting[]>([]);
  let failure = $state<string | null>(null);

  const groups = $derived(groupSettings(settings));

  onMount(() => {
    void load();
  });

  /** Loads every registered setting. */
  async function load(): Promise<void> {
    const answer = await nativeClient.GET('/api/v1/admin/settings');
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not load the settings.');
      return;
    }
    failure = null;
    settings = answer.data.settings;
  }
</script>

<svelte:head>
  <title>Settings - Hearthsound</title>
</svelte:head>

<section class="page">
  <h1>Settings</h1>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  {#each groups as group (group.segment)}
    <section class="group">
      <h2 class="group-title">{group.segment}</h2>
      {#each group.settings as setting (setting.key)}
        <SettingField {setting} onchanged={(changed) => (settings = changed)} />
      {/each}
    </section>
  {/each}

  {#if settings.length === 0 && failure === null}
    <p class="hint">No settings are registered.</p>
  {/if}
</section>

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .page h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .group {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
  }

  .group-title {
    margin: 0;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .failure {
    margin: 0;
    color: var(--color-danger);
  }

  .hint {
    margin: 0;
    color: var(--color-fg-muted);
  }
</style>
