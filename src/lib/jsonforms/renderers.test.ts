/**
 * Tests for the renderer set: which kind of control each schema shape and each
 * layout element gets.
 */
import { describe, expect, it } from 'vitest';
import type { JsonSchema, UISchemaElement } from '@jsonforms/core';

import { selectRenderer } from './renderers';

/** A schema with one property per shape the form has to draw. */
const schema: JsonSchema = {
  type: 'object',
  properties: {
    host: { type: 'string' },
    port: { type: 'integer' },
    ratio: { type: 'number' },
    enabled: { type: 'boolean' },
    mode: { type: 'string', enum: ['move', 'copy', 'link'] },
    level: { type: 'integer', enum: [1, 2, 3] },
    tags: { type: 'array', items: { type: 'string' } },
    sizes: { type: 'array', items: { type: 'integer' } },
    nested: { type: 'object', properties: { inner: { type: 'string' } } }
  }
};

/**
 * Builds the control element of one property.
 *
 * @param name The property name.
 * @returns The control element.
 */
function control(name: string): UISchemaElement {
  return { type: 'Control', scope: `#/properties/${name}` };
}

describe('renderer selection', () => {
  it('claims one control per scalar shape', () => {
    expect(selectRenderer(control('host'), schema)).toBe('TextControl');
    expect(selectRenderer(control('port'), schema)).toBe('IntegerControl');
    expect(selectRenderer(control('ratio'), schema)).toBe('NumberControl');
    expect(selectRenderer(control('enabled'), schema)).toBe('BooleanControl');
  });

  it('prefers the enumeration control over the control of its value type', () => {
    expect(selectRenderer(control('mode'), schema)).toBe('EnumControl');
    expect(selectRenderer(control('level'), schema)).toBe('EnumControl');
  });

  it('claims an array of strings and leaves other arrays to the fallback', () => {
    expect(selectRenderer(control('tags'), schema)).toBe('StringListControl');
    expect(selectRenderer(control('sizes'), schema)).toBe('UnknownControl');
  });

  it('leaves a shape without a control to the fallback', () => {
    expect(selectRenderer(control('nested'), schema)).toBe('UnknownControl');
    expect(selectRenderer({ type: 'Categorization', elements: [] }, schema)).toBe('UnknownControl');
  });

  it('claims every layout a manifest may declare', () => {
    expect(selectRenderer({ type: 'VerticalLayout', elements: [] }, schema)).toBe('VerticalLayout');
    expect(selectRenderer({ type: 'HorizontalLayout', elements: [] }, schema)).toBe(
      'HorizontalLayout'
    );
    expect(selectRenderer({ type: 'Group', elements: [] }, schema)).toBe('Group');
    expect(selectRenderer({ type: 'Label', text: 'Settings' }, schema)).toBe('Label');
  });
});
