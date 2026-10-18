<!--
  A switch.
-->
<script lang="ts">
  import type { ControlElement, JsonSchema } from '@jsonforms/core';

  import Field from './Field.svelte';
  import type { ValidationError } from './errors';
  import { controlId } from './value';

  /** Props of the control. */
  interface Props {
    /** The control element to draw. */
    uischema: ControlElement;
    /** The schema the control's value is described by. */
    schema?: JsonSchema;
    /** The value at the control's scope. */
    value: unknown;
    /** The text of the label. */
    label: string;
    /** The schema's description of the field, when it has one. */
    hint?: string;
    /** The problems validation found for the field. */
    errors?: readonly ValidationError[];
    /** Receives the value the control reports. */
    onchange: (value: unknown) => void;
  }

  let { uischema, value, label, hint = undefined, errors = [], onchange }: Props = $props();

  const id = $derived(controlId(uischema.scope));

  /**
   * Reports the state of the switch.
   *
   * @param event The change event.
   */
  function toggle(event: Event): void {
    onchange((event.currentTarget as HTMLInputElement).checked);
  }
</script>

<Field {id} {label} {hint} {errors}>
  <input class="checkbox" {id} type="checkbox" checked={value === true} onchange={toggle} />
</Field>

<style>
  .checkbox {
    align-self: flex-start;
    width: 1.125rem;
    height: 1.125rem;
    accent-color: var(--color-accent);
  }
</style>
