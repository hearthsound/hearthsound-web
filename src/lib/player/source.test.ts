/**
 * Tests for the acquisition-source check: whether the client may promise that
 * a queued download will start by itself (E-G-1).
 */
import { describe, expect, it } from 'vitest';

import type { SystemInfo } from '#lib/stores/session.svelte';

import { hasAcquisitionSource } from './source';

/**
 * Builds a system info with the given layers.
 *
 * @param layers The provider instances assigned to each layer.
 * @returns The system info a server would answer.
 */
function systemInfo(layers: SystemInfo['layers']): SystemInfo {
  return {
    apiVersion: 1,
    serverType: 'hearthsound',
    version: '0.2.11',
    features: {
      acquireOnSave: true,
      acquireOnPlaylistAdd: true,
      serverBrowse: true,
      uploads: true
    },
    layers
  };
}

describe('acquisition source', () => {
  it('counts an unknown system info as configured', () => {
    expect(hasAcquisitionSource(null)).toBe(true);
  });

  it('counts an acquisition layer with an instance', () => {
    expect(hasAcquisitionSource(systemInfo([{ layer: 'acquisition', instances: ['slskd'] }]))).toBe(
      true
    );
  });

  it('does not count an acquisition layer with no instance', () => {
    expect(hasAcquisitionSource(systemInfo([{ layer: 'acquisition', instances: [] }]))).toBe(false);
  });

  it('does not count another layer with an instance', () => {
    expect(hasAcquisitionSource(systemInfo([{ layer: 'catalog', instances: ['deezer'] }]))).toBe(
      false
    );
  });
});
