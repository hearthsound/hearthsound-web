<!--
  The frame around one control: the label of the field, whatever input the
  control draws, the schema's description of it and the problems validation
  found for its value.
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

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
    /** The input the control draws. */
    children: Snippet;
  }

  let { id = undefined, label, hint = undefined, errors = [], children }: Props = $props();
</script>

<div class="field">
  <label class="field-label" for={id}>{label}</label>
  {@render children()}
  {#if hint !== undefined}
    <p class="field-hint">{hint}</p>
  {/if}
  {#each errors as error (error.message)}
    <p class="field-error" role="alert">{error.message}</p>
  {/each}
</div>

<style>
  .field {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
  }

  .field-label {
    font-weight: 600;
  }

  .field-hint {
    margin: 0;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .field-error {
    margin: 0;
    color: var(--color-danger);
    font-size: 0.875rem;
  }
</style>
