<!--
  The provider instances.

  An instance is one plugin configured to serve: its display name, the plugin
  it came from, whether its last health check answered, and the commands to
  check it again, to change what it was configured with, or to remove it.
-->
<script lang="ts">
  import { onMount } from 'svelte';

  import ProviderForm from '#lib/admin/ProviderForm.svelte';
  import { problemMessage } from '#lib/admin/problem';
  import type { ProviderView } from '#lib/admin/providers';
  import type { PluginView } from '#lib/admin/plugins';
  import { nativeClient } from '#lib/api/native';
  import { toasts } from '#lib/stores/toasts.svelte';

  let providers = $state<ProviderView[]>([]);
  let plugins = $state<PluginView[]>([]);
  let failure = $state<string | null>(null);
  let adding = $state(false);
  let editing = $state<ProviderView | null>(null);

  const takenSlugs = $derived(providers.map((provider) => provider.slug));
  const installable = $derived(plugins.filter((plugin) => plugin.enabled));

  onMount(() => {
    void load();
  });

  /** Loads the instances and the plugins they may be configured from. */
  async function load(): Promise<void> {
    const [instances, installed] = await Promise.all([
      nativeClient.GET('/api/v1/admin/providers'),
      nativeClient.GET('/api/v1/admin/plugins')
    ]);
    if (instances.data === undefined) {
      failure = problemMessage(instances.error, 'Could not load the instances.');
      return;
    }
    failure = null;
    providers = instances.data.providers;
    plugins = installed.data?.plugins ?? [];
  }

  /**
   * Runs one instance's health check.
   *
   * @param provider The instance to check.
   */
  async function checkHealth(provider: ProviderView): Promise<void> {
    const answer = await nativeClient.GET('/api/v1/admin/providers/{slug}/health', {
      params: { path: { slug: provider.slug } }
    });
    const health = answer.data;
    if (health === undefined) {
      toasts.push(problemMessage(answer.error, 'Could not check the instance.'), 'error');
      return;
    }
    providers = providers.map((existing) =>
      existing.slug === health.slug ? { ...existing, health } : existing
    );
  }

  /**
   * Removes one instance.
   *
   * @param provider The instance to remove.
   */
  async function remove(provider: ProviderView): Promise<void> {
    if (!window.confirm(`Remove ${provider.displayName}?`)) {
      return;
    }
    const answer = await nativeClient.DELETE('/api/v1/admin/providers/{slug}', {
      params: { path: { slug: provider.slug } }
    });
    if (answer.response.status !== 204) {
      toasts.push(problemMessage(answer.error, 'Could not remove the instance.'), 'error');
      return;
    }
    providers = providers.filter((existing) => existing.slug !== provider.slug);
  }

  /**
   * Adds an instance the server just configured.
   *
   * @param provider The instance.
   */
  function added(provider: ProviderView): void {
    adding = false;
    providers = [...providers, provider];
  }

  /**
   * Replaces an instance the server just changed.
   *
   * @param provider The instance as it is now.
   */
  function saved(provider: ProviderView): void {
    editing = null;
    providers = providers.map((existing) =>
      existing.slug === provider.slug ? provider : existing
    );
  }
</script>

<svelte:head>
  <title>Providers - Hearthsound</title>
</svelte:head>

<section class="page">
  <header class="header">
    <h1>Instances</h1>
    <button type="button" onclick={() => (adding = true)} disabled={installable.length === 0}>
      Add instance
    </button>
  </header>

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}

  <table class="table">
    <thead>
      <tr>
        <th scope="col">Instance</th>
        <th scope="col">Plugin</th>
        <th scope="col">Health</th>
        <th scope="col"><span class="visually-hidden">Commands</span></th>
      </tr>
    </thead>
    <tbody>
      {#each providers as provider (provider.slug)}
        <tr>
          <td>
            <span class="name">{provider.displayName}</span>
            <span class="slug">{provider.slug}</span>
          </td>
          <td>{provider.pluginId}</td>
          <td>
            <span
              class="dot {provider.health === null || provider.health === undefined
                ? 'unknown'
                : provider.health.ok
                  ? 'ok'
                  : 'failed'}"
            ></span>
            <span class="health">
              {provider.health === null || provider.health === undefined
                ? 'Not checked yet'
                : provider.health.detail}
            </span>
          </td>
          <td class="commands">
            <button type="button" onclick={() => checkHealth(provider)}>Check health</button>
            <button type="button" onclick={() => (editing = provider)}>Edit</button>
            <button type="button" onclick={() => remove(provider)}>Delete</button>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if providers.length === 0 && failure === null}
    <p class="hint">No instances yet. Configure one from an installed plugin.</p>
  {/if}
</section>

{#if adding}
  <ProviderForm
    provider={null}
    plugins={installable}
    {takenSlugs}
    onclose={() => (adding = false)}
    onsaved={added}
  />
{/if}

{#if editing !== null}
  <ProviderForm
    provider={editing}
    plugins={installable}
    {takenSlugs}
    onclose={() => (editing = null)}
    onsaved={saved}
  />
{/if}

<style>
  .page {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }

  .header {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    align-items: baseline;
    justify-content: space-between;
  }

  .header h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .header button,
  .commands button {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .header button:hover,
  .commands button:hover {
    color: var(--color-accent);
  }

  .header button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .table {
    width: 100%;
    border-collapse: collapse;
  }

  .table th,
  .table td {
    padding: var(--space-2);
    text-align: left;
    vertical-align: top;
    border-bottom: var(--border-width) solid var(--color-border);
  }

  .table th {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
    font-weight: 600;
  }

  .name {
    display: block;
  }

  .slug {
    display: block;
    color: var(--color-fg-muted);
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }

  .dot {
    display: inline-block;
    width: 0.625rem;
    height: 0.625rem;
    margin-right: var(--space-2);
    border-radius: 50%;
    background: var(--color-fg-muted);
  }

  .dot.ok {
    background: #2f8f4e;
  }

  .dot.failed {
    background: var(--color-danger);
  }

  .health {
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .commands {
    display: flex;
    gap: var(--space-1);
    justify-content: flex-end;
  }

  .failure {
    margin: 0;
    color: var(--color-danger);
  }

  .hint {
    margin: 0;
    color: var(--color-fg-muted);
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
