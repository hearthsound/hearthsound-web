<!--
  A form rendered from a JSON Schema and a UI schema.

  A plugin's configuration arrives as those two documents; the form draws the
  layout, binds every control to its scope of the data, validates the data with
  the schema and reports every change - the new data and the problems it has -
  to the page that owns the value. The form is the k32 column: labelled fields
  18 px apart.
-->
<script lang="ts">
  import type { JsonSchema, UISchemaElement } from '@jsonforms/core';

  import JsonNode from './JsonNode.svelte';
  import { createValidator, validationErrors } from './errors';
  import type { FormChangeHandler } from './form';
  import { applyChange } from './form';
  import { resolveUiSchema } from './uischema';

  /** Props of the form. */
  interface Props {
    /** The JSON Schema the data is validated against. */
    schema: JsonSchema;
    /** The layout to draw; `null` draws every property of the schema. */
    uischema?: UISchemaElement | null;
    /** The data the form edits. */
    data: unknown;
    /** Receives the data and the problems it has after every change. */
    onchange?: FormChangeHandler;
  }

  let { schema, uischema = null, data, onchange = () => {} }: Props = $props();

  const layout = $derived(resolveUiSchema(schema, uischema));
  const validator = $derived(createValidator(schema));
  const errors = $derived(validationErrors(validator, data));

  /**
   * Applies one control's change and reports the result.
   *
   * @param scope The changed control's scope.
   * @param value The value the control reported.
   */
  function change(scope: string, value: unknown): void {
    const result = applyChange(validator, data, scope, value);
    onchange(result.data, result.errors);
  }
</script>

<div class="hs-form">
  <JsonNode element={layout} {schema} {data} {errors} onchange={change} />
</div>
