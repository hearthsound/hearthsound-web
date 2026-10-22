/**
 * The health pill's wording.
 */
import { describe, expect, it } from 'vitest';

import { healthPill } from './health';

describe('healthPill', () => {
  it('reads Ready for any passing check, whatever the probe said', () => {
    expect(healthPill({ ok: true, detail: 'album ready' })).toEqual({
      tone: 'success',
      glyph: 'adwaita-check',
      label: 'Ready'
    });
    expect(healthPill({ ok: true, detail: '' }).label).toBe('Ready');
  });

  it('carries the failure detail, and Failed when the probe gave none', () => {
    expect(healthPill({ ok: false, detail: 'Connection refused' }).label).toBe(
      'Connection refused'
    );
    expect(healthPill({ ok: false, detail: '  ' }).label).toBe('Failed');
  });

  it('says when the server never checked the instance', () => {
    expect(healthPill(null)).toEqual({
      tone: 'neutral',
      glyph: 'custom-unknown',
      label: 'Not checked yet'
    });
  });
});
