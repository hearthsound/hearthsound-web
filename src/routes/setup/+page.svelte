<!--
  The first-run wizard.

  A fresh server needs an administrator, folders to scan, plugins to serve from,
  their configuration, the order of the layers and a last look at what answers;
  the steps below walk that list and leave each of them done. A server that has
  an administrator starts at the music folders, because the account exists
  already, and the guard beside this page keeps everyone but an administrator
  away from it.

  The frame is the plain onboarding frame (l12-r1): the lockup at the top left,
  the k29 stepper or phone step line, the step body and the footer inside a 760
  px column. The page heading stays as the document's only h1 and is visually
  hidden, because the boards draw the step title as the visible heading.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';

  import type { components } from '#lib/api/schema';
  import { nativeClient } from '#lib/api/native';
  import { navigate } from '#lib/navigation';
  import AdminStep from '#lib/setup/AdminStep.svelte';
  import ConfigureStep from '#lib/setup/ConfigureStep.svelte';
  import FoldersStep from '#lib/setup/FoldersStep.svelte';
  import OrderStep from '#lib/setup/OrderStep.svelte';
  import PluginsStep from '#lib/setup/PluginsStep.svelte';
  import SummaryStep from '#lib/setup/SummaryStep.svelte';
  import { OrderState } from '#lib/setup/order-state.svelte';
  import { setupSteps, setupToken } from '#lib/setup/steps';
  import { events } from '#lib/stores/events.svelte';
  import { session } from '#lib/stores/session.svelte';
  import Lockup from '#lib/ui/Lockup.svelte';
  import Stepper from '#lib/ui/Stepper.svelte';

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
  /** The order of the layers, kept for the whole run so going back keeps it. */
  const order = new OrderState();

  const steps = $derived(required === null ? [] : setupSteps(required));
  const labels = $derived(steps.map((step) => (step.id === 'check' ? 'Summary' : step.title)));
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
      await navigate('/');
      return;
    }
    stepIndex = Math.max(0, index);
  }
</script>

<svelte:head>
  <title>Set up Hearthsound - Hearthsound</title>
</svelte:head>

<h1 class="hs-visually-hidden">Set up Hearthsound</h1>

<div class="hs-onboarding">
  <div class="hs-onboarding__top">
    <Lockup />
  </div>

  <div class="hs-onboarding__body">
    <div class="hs-setup">
      {#if required === null}
        <p class="hs-setting-row__subtitle">Reading what this server needs...</p>
      {:else}
        <Stepper steps={labels} current={stepIndex + 1} />

        {#if current === 'administrator'}
          <AdminStep {token} onsubmitted={adopted} />
        {:else if current === 'folders'}
          <FoldersStep
            {ownerId}
            oncontinue={() => goTo(stepIndex + 1)}
            onback={() => goTo(stepIndex - 1)}
          />
        {:else if current === 'plugins'}
          <PluginsStep
            bind:selection
            oncontinue={() => goTo(stepIndex + 1)}
            onback={() => goTo(stepIndex - 1)}
          />
        {:else if current === 'configure'}
          <ConfigureStep
            {selection}
            oncontinue={() => goTo(stepIndex + 1)}
            onback={() => goTo(stepIndex - 1)}
          />
        {:else if current === 'order'}
          <OrderStep
            {order}
            selected={selection}
            oncontinue={() => goTo(stepIndex + 1)}
            onback={() => goTo(stepIndex - 1)}
          />
        {:else if current === 'check'}
          <SummaryStep oncontinue={() => goTo(stepIndex + 1)} onback={() => goTo(stepIndex - 1)} />
        {/if}
      {/if}
    </div>
  </div>
</div>
