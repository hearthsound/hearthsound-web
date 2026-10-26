/**
 * Tests for the acquisitions groups: what each state shows, which rows offer a
 * cancel or a retry, how a row is worded, and where a stream update moves it.
 */
import { describe, expect, it } from 'vitest';

import {
  acquisitionFailureText,
  acquisitionIsActive,
  acquisitionPill,
  acquisitionProgress,
  acquisitionTargetKindLabel,
  acquisitionTargetTitle,
  acquisitionSummary,
  canCancel,
  canRetry,
  mergeUpdate,
  timeText
} from './acquisitions';
import type { AcquisitionView } from './acquisitions';
import type { AcquisitionUpdatedPayload } from '#lib/stores/events.svelte';

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
    percent,
    // Nothing parks a fixture acquisition: it either runs or has failed.
    awaitingSource: false,
    // The row is a track unless a test says it is a whole album.
    targetKind: 'track'
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

  it('words a parked acquisition with the cause the server named', () => {
    const noSource = {
      ...acquisition('ac_1', 'queued'),
      awaitingSource: true,
      parkReason: 'no-source' as const
    };
    const answering = {
      ...acquisition('ac_1', 'queued'),
      awaitingSource: true,
      parkReason: 'source-unavailable' as const
    };

    expect(acquisitionProgress(noSource)).toBe('Waiting for a source');
    expect(acquisitionProgress(answering)).toBe('Download source not answering');
    // A row the server names no cause for still reads as waiting, not searching.
    expect(acquisitionProgress({ ...acquisition('ac_1', 'queued'), awaitingSource: true })).toBe(
      'Waiting for a source'
    );
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

  it('draws a parked acquisition as waiting rather than searching', () => {
    const parked = {
      ...acquisition('ac_1', 'queued'),
      awaitingSource: true,
      parkReason: 'no-source' as const
    };

    expect(acquisitionPill(parked)).toEqual({
      tone: 'neutral',
      glyph: 'adwaita-pause',
      label: 'Waiting for a source'
    });
  });

  it('falls back to the unknown state for a state it does not map', () => {
    expect(acquisitionPill(acquisition('ac_1', 'quarantined'))).toEqual({
      tone: 'neutral',
      glyph: 'custom-unknown',
      label: 'quarantined'
    });
  });
});

describe('album acquisitions', () => {
  /** An album acquisition, as the server reports one. */
  const albumRow = {
    ...acquisition('ac_2', 'cancelled'),
    targetKind: 'album' as const,
    albumTitle: 'Second Wind',
    albumArtist: 'Discography Artist',
    failureReason: 'cancelled' as const
  };

  it('names the album rather than an unknown track', () => {
    expect(acquisitionTargetTitle(albumRow)).toBe('Second Wind');
    expect(acquisitionTargetKindLabel(albumRow)).toBe('Album');
    expect(acquisitionTargetKindLabel(acquisition('ac_1', 'queued'))).toBe('Track');
  });

  it('words a failure as an album failure', () => {
    expect(acquisitionFailureText(albumRow)).toBe('Could not get this album: it was cancelled.');
    expect(
      acquisitionFailureText({ ...acquisition('ac_1', 'failed'), failureReason: 'quota-exceeded' })
    ).toBe('Could not get this song: your daily quota is used up.');
  });

  it('takes the row summary artist from the album', () => {
    expect(acquisitionSummary(albumRow, '12:04')).toBe(
      'Discography Artist - Queue priority - 12:04'
    );
  });

  it('falls back to the track wording for a row without a title', () => {
    expect(acquisitionTargetTitle(acquisition('ac_1', 'queued'))).toBe('Unknown track');
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

describe('acquisition updates', () => {
  /**
   * Builds the payload of one acquisition update.
   *
   * @param id The acquisition's client id.
   * @param state The state the server reported.
   * @returns The payload.
   */
  function update(id: string, state: string): AcquisitionUpdatedPayload {
    return {
      acquisitionId: id,
      targetId: 'tr_1',
      state,
      priority: 'queue'
    } as AcquisitionUpdatedPayload;
  }

  it('reports an id no group holds and leaves both lists as they were', () => {
    const active = [acquisition('ac_1', 'downloading')];
    const recent = [acquisition('ac_0', 'completed')];

    const merged = mergeUpdate(update('ac_9', 'queued'), 3, active, recent);

    expect(merged.unknown).toBe(true);
    expect(merged.active).toBe(active);
    expect(merged.recent).toBe(recent);
  });

  it('moves an active row to the ended group once it turns terminal', () => {
    const active = [acquisition('ac_1', 'downloading'), acquisition('ac_2', 'queued')];
    const recent = [acquisition('ac_0', 'completed')];

    const merged = mergeUpdate(update('ac_1', 'failed'), 5, active, recent);

    expect(merged.unknown).toBe(false);
    expect(merged.active.map((row) => row.id)).toEqual(['ac_2']);
    expect(merged.recent.map((row) => row.id)).toEqual(['ac_1', 'ac_0']);
    expect(merged.recent[0].state).toBe('failed');
    expect(merged.recent[0].updatedAt).toBe(5);
  });

  it('keeps a row that still holds work at the head of the active group', () => {
    const active = [acquisition('ac_1', 'queued'), acquisition('ac_2', 'queued')];
    const recent = [acquisition('ac_0', 'completed')];

    const merged = mergeUpdate(update('ac_1', 'downloading'), 6, active, recent);

    expect(merged.active.map((row) => row.id)).toEqual(['ac_1', 'ac_2']);
    expect(merged.recent.map((row) => row.id)).toEqual(['ac_0']);
  });
});

describe('acquisition update time', () => {
  it('words the time of day', () => {
    expect(timeText(new Date(2026, 9, 21, 12, 4).getTime())).toMatch(/^12:04/);
  });
});
