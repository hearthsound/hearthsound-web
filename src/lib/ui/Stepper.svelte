<!--
  The setup stepper (k29).

  Desktop shows the ordered list of six steps across the top: done steps carry
  a check and a visually hidden "completed", the current step carries
  aria-current="step". Phones show the current marker, the step name and
  "Step N of M" above a segmented line. Steps are not links.

  Usage:
  `<Stepper steps={['Administrator', 'Music folders', 'Plugins', 'Configure',
    'Order', 'Summary']} current={2} />`
-->
<script lang="ts">
  import Icon from './Icon.svelte';

  /** Props of the stepper. */
  interface Props {
    /** The step names, in order. */
    steps: string[];
    /** The current step, counting from 1. */
    current: number;
  }

  let { steps, current }: Props = $props();

  const at = $derived(Math.min(Math.max(current, 1), steps.length));
  const currentName = $derived(steps[at - 1] ?? '');
  const segmentIndexes = $derived([...steps.keys()]);
</script>

<ol class="hs-stepper">
  {#each steps as step, index (index)}
    {#if index > 0}
      <li class="hs-step__connector" aria-hidden="true"></li>
    {/if}
    <li
      class="hs-step"
      class:hs-step--done={index + 1 < at}
      aria-current={index + 1 === at ? 'step' : undefined}
    >
      <span class="hs-step__marker">
        {#if index + 1 < at}
          <Icon name="adwaita-check" />
        {:else}
          {index + 1}
        {/if}
      </span>
      {step}
      {#if index + 1 < at}
        <span class="hs-visually-hidden">completed</span>
      {/if}
    </li>
  {/each}
</ol>

<div class="hs-step-line" role="group" aria-label="Step {at} of {steps.length}, {currentName}">
  <span class="hs-step-line__row">
    <span class="hs-step__marker">{at}</span>
    {currentName}
    <span class="hs-step-line__count">Step {at} of {steps.length}</span>
  </span>
  {#each segmentIndexes as index (index)}
    <span
      class="hs-step-line__segment"
      class:hs-step-line__segment--done={index + 1 < at}
      class:hs-step-line__segment--current={index + 1 === at}
    ></span>
  {/each}
</div>
