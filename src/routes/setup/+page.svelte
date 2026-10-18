<!--
  The first-run wizard.

  A fresh server needs an administrator, folders to scan, plugins to serve from,
  their configuration, the order of the layers and a last look at what answers;
  the steps below walk that list and leave each of them done. A server that has
  an administrator starts at the music folders, because the account exists
  already, and the guard beside this page keeps everyone but an administrator
  away from it.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';

  import type { components } from '#lib/api/schema';
  import { nativeClient } from '#lib/api/native';
  import { navigate } from '#lib/navigation';
  import AdminStep from '#lib/setup/AdminStep.svelte';
  import CheckStep from '#lib/setup/CheckStep.svelte';
  import ConfigureStep from '#lib/setup/ConfigureStep.svelte';
  import FoldersStep from '#lib/setup/FoldersStep.svelte';
  import OrderStep from '#lib/setup/OrderStep.svelte';
  import PluginsStep from '#lib/setup/PluginsStep.svelte';
  import { setupSteps, setupToken } from '#lib/setup/steps';
  import { events } from '#lib/stores/events.svelte';
  import { session } from '#lib/stores/session.svelte';

  /** The session the server started for the administrator it created. */
  type StartedSession = components['schemas']['LoginResponse'];

  /** Whether the server still needs its first administrator, or `null` while unknown. */
  let required = $state<boolean | null>(null);
  /** The step being walked. */
  let stepIndex = $state(0);
  /** The token the setup link carried, when it carried one. */
  let token = $state<string | null>(null);
  /** The administrator the run works for: the one it created, or the signed-in one. */
  let admin = $state<StartedSession['user'] | null>(null);
  /** The plugin ids the administrator checked in the plugins step. */
  let selection = $state<string[]>([]);

  const steps = $derived(required === null ? [] : setupSteps(required));
  const current = $derived(steps[stepIndex]?.id ?? null);
  const ownerId = $derived(admin?.id ?? session.user?.id ?? '');

  onMount(async () => {
    token = setupToken(page.url.search);
    const answer = await nativeClient.GET('/api/v1/setup');
    required = answer.data?.required === true;
    admin = session.user;
  });

  /**
   * Adopts the session of the administrator that was just created.
   *
   * @param started The session the server answered the setup with.
   */
  async function adopted(started: StartedSession): Promise<void> {
    session.adopt(started);
    admin = started.user;
    await session.loadSystemInfo();
    events.open();
    await goTo(stepIndex + 1);
  }

  /**
   * Moves to one step, and leaves the wizard when none is left.
   *
   * @param index The step to show.
   */
  async function goTo(index: number): Promise<void> {
    if (index >= steps.length) {
      await navigate('/library/albums');
      return;
    }
    stepIndex = Math.max(0, index);
  }
</script>

<svelte:head>
  <title>Set up Hearthsound</title>
</svelte:head>

<section class="wizard">
  <h1>Set up Hearthsound</h1>

  {#if required === null}
    <p class="hint">Reading what this server needs...</p>
  {:else}
    <ol class="steps">
      {#each steps as step, index (step.id)}
        <li class="step-entry" aria-current={index === stepIndex ? 'step' : undefined}>
          <span class="step-number">{index + 1}</span>
          {step.title}
        </li>
      {/each}
    </ol>

    {#if current === 'administrator'}
      <AdminStep {token} onsubmitted={adopted} />
    {:else if current === 'folders'}
      <FoldersStep {ownerId} oncontinue={() => goTo(stepIndex + 1)} />
    {:else if current === 'plugins'}
      <PluginsStep bind:selection oncontinue={() => goTo(stepIndex + 1)} />
    {:else if current === 'configure'}
      <ConfigureStep {selection} oncontinue={() => goTo(stepIndex + 1)} />
    {:else if current === 'order'}
      <OrderStep selected={selection} oncontinue={() => goTo(stepIndex + 1)} />
    {:else if current === 'check'}
      <CheckStep oncontinue={() => goTo(stepIndex + 1)} />
    {/if}

    {#if stepIndex > 0}
      <div class="commands">
        <button type="button" onclick={() => goTo(stepIndex - 1)}>Back</button>
      </div>
    {/if}
  {/if}
</section>

<style>
  .wizard {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    max-width: 48rem;
  }

  .wizard h1 {
    margin: 0;
    font-size: 1.5rem;
  }

  .steps {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-3);
    margin: 0;
    padding: 0;
    color: var(--color-fg-muted);
    list-style: none;
  }

  .step-entry {
    display: flex;
    gap: var(--space-1);
    align-items: baseline;
  }

  .step-entry[aria-current='step'] {
    color: var(--color-fg);
    font-weight: 600;
  }

  .step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.75rem;
    border: var(--border-width) solid var(--color-border);
    border-radius: 50%;
  }

  .hint {
    margin: 0;
    color: var(--color-fg-muted);
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
</style>
