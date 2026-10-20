<!--
  The frame around one control: the label of the field, whatever input the
  control draws, the schema's description of it and the problems validation
  found for its value (k32).

  The label sits above the control and turns accent while the control has
  focus. An error replaces the hint in the k32 error line. A control that
  carries its own label, like the checkbox, sets `labelled` so the frame does
  not draw a second one.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  import FormField from '#lib/ui/FormField.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import type { ValidationError } from './errors';

  /** Props of the frame. */
  interface Props {
    /** The id of the input the label points at, when the control has one. */
    id?: string;
    /** The text of the label. */
    label: string;
    /** The schema's description of the field, when it has one. */
    hint?: string;
    /** The problems validation found for the field. */
    errors?: readonly ValidationError[];
    /** Whether the control draws the label itself, as a checkbox row does. */
    labelled?: boolean;
    /** The input the control draws. */
    children: Snippet;
  }

  let {
    id = undefined,
    label,
    hint = undefined,
    errors = [],
    labelled = false,
    children
  }: Props = $props();

  const error = $derived(errors.map((problem) => problem.message).join(' '));
</script>

{#if labelled}
  <div class="frame">
    {@render children()}
    {#if errors.length > 0}
      <p class="hs-form-field__error" role="alert">
        <Icon name="adwaita-error" />
        {error}
      </p>
    {:else if hint !== undefined}
      <span class="hs-form-field__hint">{hint}</span>
    {/if}
  </div>
{:else}
  <FormField {label} for={id} {hint} error={errors.length === 0 ? undefined : error}>
    {@render children()}
  </FormField>
{/if}

<style>
  .frame {
    display: flex;
    flex-direction: column;
    gap: var(--hs-space-3);
  }
</style>
