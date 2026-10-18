/**
 * The UI schema a form renders.
 *
 * A plugin's manifest may hand over a UI schema of its own; when it does not,
 * the form generates one that shows every property of the schema it was given,
 * so a plugin that describes only its values still gets a usable form.
 */
import { Generate } from '@jsonforms/core';
import type { JsonSchema, UISchemaElement } from '@jsonforms/core';

/**
 * Returns the UI schema a form renders.
 *
 * @param schema The JSON Schema of the form.
 * @param uischema The UI schema to render, or `null` to generate one.
 * @returns The given UI schema, or a vertical layout of every property of the
 *   schema.
 */
export function resolveUiSchema(
  schema: JsonSchema,
  uischema: UISchemaElement | null
): UISchemaElement {
  return uischema ?? Generate.uiSchema(schema);
}
