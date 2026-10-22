<!--
  The server settings (p26c A, p26-key A, c01, k28).

  Every setting the page may show is grouped under the first segment of its key
  with a capitalised title; each row is titled with its readable c01 name and
  carries the server's description, the origin of a pinned value with a lock,
  and a control that saves on its own. The key is not displayed: the row carries
  it as `data-setting` for the tests (p26-key). A server with nothing registered
  shows one line, not a status page (c03 item 11).
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import SettingField from '#lib/admin/SettingField.svelte';
  import { groupTitle } from '#lib/admin/setting-names';
  import { groupSettings, visibleSettings } from '#lib/admin/settings';
  import type { ServerSetting } from '#lib/admin/settings';
  import { nativeClient } from '#lib/api/native';
  import { getShellNavigation } from '#lib/shell-navigation';
  import Button from '#lib/ui/Button.svelte';
  import PageHeader from '#lib/ui/PageHeader.svelte';
  import StatusPage from '#lib/ui/StatusPage.svelte';

  const shell = getShellNavigation();

  let settings = $state<ServerSetting[]>([]);
  let failed = $state(false);

  const groups = $derived(groupSettings(visibleSettings(settings)));

  onMount(() => {
    void load();
  });

  /** Loads every registered setting. */
  async function load(): Promise<void> {
    const answer = await nativeClient.GET('/api/v1/admin/settings');
    if (answer.data === undefined) {
      failed = true;
      return;
    }
    failed = false;
    settings = answer.data.settings;
  }
</script>

<svelte:head>
  <title>Settings - Hearthsound</title>
</svelte:head>

{#snippet retryAction()}
  <Button onclick={() => void load()}>Retry</Button>
{/snippet}

<PageHeader title="Settings" class="admin-header" onnavigation={shell?.openNavigation} />

<div class="content">
  {#if failed}
    <StatusPage
      level={2}
      alert
      icon="adwaita-error"
      title="Could Not Load This Page"
      text="The server did not answer. Try again in a moment."
      action={retryAction}
    />
  {:else if groups.length === 0}
    <p class="empty">No settings are registered.</p>
  {:else}
    {#each groups as group (group.segment)}
      <section class="block">
        <h2 class="hs-section-header__title group-heading">{groupTitle(group.segment)}</h2>
        <div class="hs-settings-group group">
          {#each group.settings as setting (setting.key)}
            <SettingField {setting} onchanged={(changed) => (settings = changed)} />
          {/each}
        </div>
      </section>
    {/each}
  {/if}
</div>

<style>
  /* Layout glue only: the shell already holds the page off the window edge, so
     the k25 header aligns to that margin. The class lands on the component's
     own header, hence `:global`. */
  :global(.admin-header) {
    padding-inline: 0;
  }

  /* Layout glue only: p26c puts the groups under the header and leaves the page
     28 px at the bottom. */
  .content {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-4);
    padding-block: 0 var(--hs-space-7);
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  /* Layout glue only: the boards put the group 10 px under its heading and the
     heading 10 px below the gap above it. The package carries the 19/750 type
     on `hs-section-header__title` and no page-group heading class. */
  .group-heading {
    margin: 10px 0 0;
  }

  /* Layout glue only: the group clips its overflow to round its corners, which
     would cut off a row's menu popover. p26c caps every group at 760 px. */
  .group {
    max-width: 760px;
    overflow: visible;
  }

  /* The empty line of c03 item 11; the package has no page-text empty class. */
  .empty {
    margin: 0;
    color: var(--hs-fg-muted);
  }
</style>
