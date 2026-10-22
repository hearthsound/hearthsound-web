<!--
  The fallback for an element no renderer claims: the label of the field and a
  textarea holding the value as JSON, so a value this form does not know how to
  draw can still be read and edited.
-->
<script lang="ts">
  import type { ControlElement, JsonSchema } from '@jsonforms/core';
  import { untrack } from 'svelte';

  import TextArea from '#lib/ui/TextArea.svelte';
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
    /** The problems validation found for the field. */
    errors?: readonly ValidationError[];
    /** Receives the value the control reports. */
    onchange: (value: unknown) => void;
  }

  let { uischema, value, label, errors = [], onchange }: Props = $props();

  const id = $derived(controlId(uischema.scope));

  let text = $state(untrack(() => JSON.stringify(value ?? null, null, 2)));
  let problem = $state<string | null>(null);
  const shown = $derived<ValidationError[]>(
    problem === null ? [...errors] : [...errors, { path: '', message: problem }]
  );

  /**
   * Reports the JSON the administrator typed, when it parses.
   *
   * @param event The input event.
   */
  function input(event: Event): void {
    text = (event.currentTarget as HTMLTextAreaElement).value;
    try {
      onchange(JSON.parse(text));
      problem = null;
    } catch {
      problem = 'Enter a JSON value.';
    }
  }
</script>

<Field {id} {label} errors={shown}>
  <TextArea {id} value={text} invalid={problem !== null} oninput={input} />
</Field>
