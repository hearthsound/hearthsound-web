/**
 * Tests for the acquisitions groups: what each state shows, which rows offer a
 * cancel or a retry, and how a row is worded.
 */
import { describe, expect, it } from 'vitest';

import {
  acquisitionFailureText,
  acquisitionIsActive,
  acquisitionPill,
  acquisitionProgress,
  acquisitionSummary,
  canCancel,
  canRetry,
  timeText
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
    expect(acquisitionProgress(acquisition('ac_1', 'quarantined', 10))).toBe('quarantined');
  });

  it('keeps the percentage on downloads only', () => {
    expect(acquisitionProgress(acquisition('ac_1', 'completed', 100))).toBe('Completed');
    expect(acquisitionProgress(acquisition('ac_1', 'failed', 40))).toBe('Failed');
    expect(acquisitionProgress(acquisition('ac_1', 'downloading', 100))).toBe('Downloading 100%');
  });
});

describe('acquisition pills', () => {
  it('colours the state groups as k10 maps them', () => {
    expect(acquisitionPill(acquisition('ac_1', 'searching'))).toEqual({
      tone: 'accent',
      glyph: 'adwaita-search',
      label: 'Searching sources'
    });
    expect(acquisitionPill(acquisition('ac_1', 'downloading', 42))).toEqual({
      tone: 'accent',
      glyph: 'adwaita-acquire',
      label: 'Downloading 42%'
    });
    expect(acquisitionPill(acquisition('ac_1', 'failed')).tone).toBe('error');
    expect(acquisitionPill(acquisition('ac_1', 'completed'))).toEqual({
      tone: 'success',
      glyph: 'adwaita-check',
      label: 'Completed'
    });
    expect(acquisitionPill(acquisition('ac_1', 'cancelled')).tone).toBe('neutral');
  });

  it('falls back to the unknown state for a state it does not map', () => {
    expect(acquisitionPill(acquisition('ac_1', 'quarantined'))).toEqual({
      tone: 'neutral',
      glyph: 'custom-unknown',
      label: 'quarantined'
    });
  });
});

describe('acquisition summary', () => {
  it('words the artist, priority, instance and time', () => {
    const row: AcquisitionView = {
      ...acquisition('ac_1', 'downloading'),
      trackArtist: 'Nine Paper Cranes',
      priority: 'background',
      instance: 'sample-fetch'
    };

    expect(acquisitionSummary(row, '12:04')).toBe(
      'Nine Paper Cranes - Background priority - sample-fetch - 12:04'
    );
  });

  it('leaves out the parts the server does not name', () => {
    expect(acquisitionSummary(acquisition('ac_1', 'queued'), '11:58')).toBe(
      'Queue priority - 11:58'
    );
  });
});

describe('acquisition failures', () => {
  it('words a failure code as a sentence, never the code', () => {
    const row: AcquisitionView = {
      ...acquisition('ac_1', 'failed'),
      failureReason: 'no-candidates'
    };

    expect(acquisitionFailureText(row)).toBe('Could not get this song: no source has it.');
  });

  it('says the generic sentence for a code this client does not know', () => {
    const row: AcquisitionView = {
      ...acquisition('ac_1', 'failed'),
      failureReason: 'peer-exploded'
    };

    expect(acquisitionFailureText(row)).toBe('Could not get this song.');
  });

  it('says nothing when the server gave no reason', () => {
    expect(acquisitionFailureText(acquisition('ac_1', 'cancelled'))).toBe('');
  });
});

describe('acquisition update time', () => {
  it('words the time of day', () => {
    expect(timeText(new Date(2026, 9, 21, 12, 4).getTime())).toMatch(/^12:04/);
  });
});
