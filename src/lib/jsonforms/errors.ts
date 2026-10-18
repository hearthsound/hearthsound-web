/**
 * Validation of a form's data.
 *
 * The form compiles the schema it was handed once, validates the data against
 * it after every change, and hands each control the problems that belong to the
 * value it is bound to. A schema that cannot be compiled leaves the form
 * without validation rather than without a form, because the values still have
 * to be editable.
 */
import { createAjv, encode, toDataPathSegments, validate } from '@jsonforms/core';
import type { JsonSchema } from '@jsonforms/core';
import type { ValidateFunction } from 'ajv';

/** One problem with the form's data. */
export interface ValidationError {
  /** The JSON Pointer of the value at fault, empty for the data itself. */
  path: string;
  /** What is wrong with the value, as the validator words it. */
  message: string;
}

/**
 * Returns the JSON Pointer of a control's value.
 *
 * @param scope The control's scope, for example `#/properties/host`.
 * @returns The pointer, for example `/host`, empty for the data itself.
 */
export function valuePath(scope: string): string {
  const segments = toDataPathSegments(scope);
  return segments.length === 0 ? '' : `/${segments.map(encode).join('/')}`;
}

/**
 * Returns the problems that belong to one control.
 *
 * A control shows the problems of its own value and of the values below it, so
 * a group of values that is validated as a whole reports at the control that
 * holds it.
 *
 * @param errors Every problem the last validation found.
 * @param scope The control's scope.
 * @returns The problems to show under the control.
 */
export function errorsForPath(
  errors: readonly ValidationError[],
  scope: string
): ValidationError[] {
  const path = valuePath(scope);
  return errors.filter((error) => error.path === path || error.path.startsWith(`${path}/`));
}

/**
 * Compiles the schema a form validates against.
 *
 * @param schema The form's JSON Schema.
 * @returns The validator, or `undefined` when the schema cannot be compiled.
 */
export function createValidator(schema: JsonSchema): ValidateFunction | undefined {
  try {
    return createAjv().compile(schema);
  } catch {
    return undefined;
  }
}

/**
 * Validates the form's data.
 *
 * @param validator The compiled validator, when the schema compiled.
 * @param data The form's data.
 * @returns One entry per problem, empty when the data is valid.
 */
export function validationErrors(
  validator: ValidateFunction | undefined,
  data: unknown
): ValidationError[] {
  return validate(validator, data).map((error) => ({
    path: error.instancePath ?? '',
    message: error.message ?? 'is invalid'
  }));
}
