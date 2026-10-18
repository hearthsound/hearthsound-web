/**
 * Applying a change to a form's data.
 *
 * A control reports the value it holds at its scope; the form copies the data
 * along the way to that scope, stores the value and validates the result. The
 * arithmetic lives here so a form's reaction to an edit is testable without a
 * browser.
 */
import type { ValidateFunction } from 'ajv';

import { validationErrors } from './errors';
import type { ValidationError } from './errors';
import { writeValue } from './value';

/** What a form reports after a change. */
export interface FormChange {
  /** The form's data after the change. */
  data: unknown;
  /** The problems the data has now. */
  errors: ValidationError[];
}

/** Receives a form's data and the problems it has after a change. */
export type FormChangeHandler = (data: unknown, errors: ValidationError[]) => void;

/**
 * Applies one control's reported value to the form's data.
 *
 * Storing a value the control reported unchanged leaves the form's data as it
 * was, which is how a write-only field keeps the sealed placeholder the server
 * sent when the administrator never touched it.
 *
 * @param validator The compiled validator, when the schema compiled.
 * @param data The form's data before the change.
 * @param scope The changed control's scope, for example `#/properties/host`.
 * @param value The value the control reported.
 * @returns The data after the change, with the problems it now has.
 */
export function applyChange(
  validator: ValidateFunction | undefined,
  data: unknown,
  scope: string,
  value: unknown
): FormChange {
  const next = writeValue(data, scope, value);
  return { data: next, errors: validationErrors(validator, next) };
}
