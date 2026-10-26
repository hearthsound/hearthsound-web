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

  Once the run has created its administrator the step list drops that step, so
  the first step left - the music folders - has no Back to a form whose link is
  spent.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';

  import type { components } from '#lib/api/schema';
  import { navigate } from '#lib/navigation';
  import { checkSetupToken, getSetupStatus } from '#lib/setup/api';
  import type { SetupTokenState } from '#lib/setup/api';
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
  /** What the pre-flight check of that link answered. */
  let tokenState = $state<SetupTokenState>('unknown');
  /** The administrator the run works for: the one it created, or the signed-in one. */
  let admin = $state<StartedSession['user'] | null>(null);
  /** The plugin ids the administrator checked in the plugins step. */
  let selection = $state<string[]>([]);
  /** Whether the plugins step offered the shipped plugins in this run. */
  let pluginsSeeded = $state(false);
  /** The order of the layers, kept for the whole run so going back keeps it. */
  const order = new OrderState();

  const steps = $derived(required === null ? [] : setupSteps(required));
  const labels = $derived(steps.map((step) => (step.id === 'check' ? 'Summary' : step.title)));
  const current = $derived(steps[stepIndex]?.id ?? null);
  const ownerId = $derived(admin?.id ?? session.user?.id ?? '');
  /**
   * What the footer's Back walks to: nothing on the first step the run walks,
   * so a server that just gained its administrator cannot send the browser back
   * to a form whose link was spent.
   */
  const back = $derived(stepIndex === 0 ? undefined : () => goTo(stepIndex - 1));

  onMount(async () => {
    token = setupToken(page.url.search);
    const result = await getSetupStatus();
    required = result.ok && result.value.required;
    admin = session.user;
    // A link that is no longer the live one is refused before the form is
    // drawn; a server that already has its administrator is left alone, because
    // the guard beside this page is already sending that browser elsewhere.
    if (token !== null && required === true) {
      tokenState = await checkSetupToken(token);
    }
  });

  /**
   * Adopts the session of the administrator that was just created.
   *
   * The server no longer needs an administrator, so the step list drops the
   * step that created it before the wizard moves: the same logical step - the
   * music folders - stays current, and Back has nothing to return to.
   *
   * @param started The session the server answered the setup with.
   */
  async function adopted(started: StartedSession): Promise<void> {
    session.adopt(started);
    admin = started.user;
    await session.loadSystemInfo();
    events.open();
    const next = steps[stepIndex + 1]?.id ?? null;
    required = false;
    const index = next === null ? steps.length : steps.findIndex((step) => step.id === next);
    await goTo(index < 0 ? 0 : index);
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

<div class="hs-onboarding">
  <div class="hs-onboarding__top">
    <Lockup />
  </div>

  <main class="hs-onboarding__body">
    <h1 class="hs-visually-hidden">Set up Hearthsound</h1>
    <div class="hs-setup">
      {#if required === null}
        <p class="hs-setting-row__subtitle">Reading what this server needs...</p>
      {:else}
        <Stepper steps={labels} current={stepIndex + 1} />

        {#if current === 'administrator'}
          <AdminStep {token} {tokenState} onsubmitted={adopted} />
        {:else if current === 'folders'}
          <FoldersStep {ownerId} oncontinue={() => goTo(stepIndex + 1)} onback={back} />
        {:else if current === 'plugins'}
          <PluginsStep
            bind:selection
            bind:seeded={pluginsSeeded}
            oncontinue={() => goTo(stepIndex + 1)}
            onback={back}
          />
        {:else if current === 'configure'}
          <ConfigureStep {selection} oncontinue={() => goTo(stepIndex + 1)} onback={back} />
        {:else if current === 'order'}
          <OrderStep
            {order}
            selected={selection}
            oncontinue={() => goTo(stepIndex + 1)}
            onback={back}
          />
        {:else if current === 'check'}
          <SummaryStep oncontinue={() => goTo(stepIndex + 1)} onback={back} />
        {/if}
      {/if}
    </div>
  </main>
</div>
