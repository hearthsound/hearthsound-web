/**
 * Tests for the wording the plugin views show.
 */
import { describe, expect, it } from 'vitest';

import { pluginStateLabel, riskLabel, sourceLabel } from './plugins';

describe('plugin labels', () => {
  it('words every lifecycle state the server reports', () => {
    expect(pluginStateLabel('pending-approval')).toBe('Waiting for approval');
    expect(pluginStateLabel('upgrade-pending-approval')).toBe('Upgrade waiting for approval');
    expect(pluginStateLabel('enabled')).toBe('Enabled');
    expect(pluginStateLabel('disabled')).toBe('Disabled');
  });

  it('words the risk of a permission', () => {
    expect(riskLabel('low')).toBe('Low risk');
    expect(riskLabel('medium')).toBe('Medium risk');
    expect(riskLabel('high')).toBe('High risk');
  });

  it('words where a plugin came from', () => {
    expect(sourceLabel('official')).toBe('Official index');
    expect(sourceLabel('sideload')).toBe('Uploaded');
  });

  it('keeps a value it does not know readable', () => {
    expect(pluginStateLabel('quarantined')).toBe('quarantined');
    expect(riskLabel('extreme')).toBe('extreme');
    expect(sourceLabel('mirror')).toBe('mirror');
  });
});
