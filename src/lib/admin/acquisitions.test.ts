/**
 * Tests for the acquisitions table: what each state shows, which rows the
 * filter keeps, and which of them offer a cancel or a retry.
 */
import { describe, expect, it } from 'vitest';

import {
  acquisitionIsActive,
  acquisitionProgress,
  ACQUISITION_FILTERS,
  canCancel,
  canRetry,
  filterAcquisitions
} from './acquisitions';
import type { AcquisitionView } from './acquisitions';

/**
 * Builds one acquisition in the given state.
 *
 * @param id The acquisition's client id.
 * @param state The lifecycle state.
 * @param percent The download progress, when the server reported one.
 * @returns The acquisition.
 */
function acquisition(id: string, state: string, percent: number | null = null): AcquisitionView {
  return {
    id,
    state,
    priority: 'queue',
    createdAt: 1,
    updatedAt: 2,
    percent
  };
}

describe('acquisition state', () => {
  it('holds work until it completes, fails or is cancelled', () => {
    for (const state of [
      'queued',
      'resolving',
      'searching',
      'downloading',
      'verifying',
      'importing'
    ]) {
      expect(acquisitionIsActive(acquisition('ac_1', state))).toBe(true);
    }
    for (const state of ['completed', 'failed', 'cancelled']) {
      expect(acquisitionIsActive(acquisition('ac_1', state))).toBe(false);
    }
  });

  it('offers a cancel while the acquisition holds work', () => {
    expect(canCancel(acquisition('ac_1', 'downloading'))).toBe(true);
    expect(canCancel(acquisition('ac_1', 'completed'))).toBe(false);
  });

  it('offers a retry for an acquisition that ended without a file', () => {
    expect(canRetry(acquisition('ac_1', 'failed'))).toBe(true);
    expect(canRetry(acquisition('ac_1', 'cancelled'))).toBe(true);
    expect(canRetry(acquisition('ac_1', 'completed'))).toBe(false);
    expect(canRetry(acquisition('ac_1', 'queued'))).toBe(false);
  });
});

describe('acquisition progress', () => {
  it('words the state and adds the percentage the server reported', () => {
    expect(acquisitionProgress(acquisition('ac_1', 'searching'))).toBe('Searching sources');
    expect(acquisitionProgress(acquisition('ac_1', 'downloading'))).toBe('Downloading');
    expect(acquisitionProgress(acquisition('ac_1', 'downloading', 40.7))).toBe('Downloading 40%');
    expect(acquisitionProgress(acquisition('ac_1', 'completed'))).toBe('Completed');
  });

  it('shows a state this client does not know as it arrived', () => {
    expect(acquisitionProgress(acquisition('ac_1', 'quarantined', 10))).toBe('quarantined 10%');
  });
});

describe('acquisition filter', () => {
  const rows = [
    acquisition('ac_1', 'downloading', 40),
    acquisition('ac_2', 'completed'),
    acquisition('ac_3', 'failed'),
    acquisition('ac_4', 'queued')
  ];

  it('separates the rows that still hold work from the ones that ended', () => {
    expect(filterAcquisitions(rows, 'active').map((row) => row.id)).toEqual(['ac_1', 'ac_4']);
    expect(filterAcquisitions(rows, 'recent').map((row) => row.id)).toEqual(['ac_2', 'ac_3']);
    expect(filterAcquisitions(rows, 'all')).toHaveLength(4);
  });

  it('offers the three filters in the order the view shows them', () => {
    expect(ACQUISITION_FILTERS).toEqual(['active', 'recent', 'all']);
  });
});
