/**
 * Tests for schema validation: the problems of the data and the control each
 * problem belongs to.
 */
import { describe, expect, it } from 'vitest';
import type { JsonSchema } from '@jsonforms/core';

import { createValidator, errorsForPath, validationErrors } from './errors';

/** A schema whose two properties each allow one value. */
const schema: JsonSchema = {
  type: 'object',
  properties: {
    host: { type: 'string', minLength: 3 },
    retries: { type: 'integer', maximum: 10 }
  }
};

describe('validation', () => {
  it('reports nothing for data that fits the schema', () => {
    const validator = createValidator(schema);

    expect(validationErrors(validator, { host: 'host', retries: 3 })).toEqual([]);
  });

  it('gives every problem to the control its path belongs to', () => {
    const validator = createValidator(schema);

    const errors = validationErrors(validator, { host: 'a', retries: 40 });

    expect(errors).toHaveLength(2);
    const host = errorsForPath(errors, '#/properties/host');
    const retries = errorsForPath(errors, '#/properties/retries');
    expect(host.map((error) => error.path)).toEqual(['/host']);
    expect(retries.map((error) => error.path)).toEqual(['/retries']);
    expect(errorsForPath(errors, '#/properties/missing')).toEqual([]);
  });

  it('shows a problem of a value below a control under that control', () => {
    const nested: JsonSchema = {
      type: 'object',
      properties: {
        host: { type: 'object', properties: { url: { type: 'string', minLength: 3 } } }
      }
    };

    const errors = validationErrors(createValidator(nested), { host: { url: 'a' } });

    expect(errorsForPath(errors, '#/properties/host')).toHaveLength(1);
    expect(errorsForPath(errors, '#/properties/host/properties/url')).toHaveLength(1);
  });

  it('leaves a schema that cannot be compiled without validation', () => {
    // No JSON Schema names the type `not-a-type`, so the compiler refuses it.
    const invalid: JsonSchema = { type: 'not-a-type' } as unknown as JsonSchema;
    const validator = createValidator(invalid);

    expect(validator).toBeUndefined();
    expect(validationErrors(validator, { anything: true })).toEqual([]);
  });
});
