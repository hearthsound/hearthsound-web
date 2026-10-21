/**
 * Tests for the folder fields and the line a live scan reports.
 */
import { describe, expect, it } from 'vitest';

import {
  folderPatchBody,
  lastScanText,
  newFolderBody,
  ownerLabel,
  scanProgressText
} from './folders';
import type { FolderView } from './folders';
import type { ScanProgressPayload } from '#lib/stores/events.svelte';

/** A folder owned by one account. */
const folder: FolderView = {
  id: 'lf_1',
  path: '/srv/music',
  name: 'Music',
  generic: false,
  owner: 'us_1',
  watch: true,
  createdAt: 1,
  lastScanAt: null
};

/** The progress of a scan that is working through a folder. */
const progress: ScanProgressPayload = {
  folderId: 'lf_1',
  phase: 'indexing',
  filesSeen: 40,
  filesDone: 12
};

describe('folder fields', () => {
  it('names the owner of a folder and calls an unowned one generic', () => {
    const names = new Map([['us_1', 'Ada']]);

    expect(ownerLabel(folder, names)).toBe('Ada');
    expect(ownerLabel({ ...folder, generic: true }, names)).toBe('Generic');
    expect(ownerLabel({ ...folder, owner: 'us_2' }, names)).toBe('us_2');
  });

  it('reports what a scan is doing and how far it has come', () => {
    expect(scanProgressText(progress)).toBe('Scanning: 12 of 40 files');
    expect(scanProgressText({ ...progress, phase: 'pruning' })).toBe(
      'Removing missing files: 40 seen'
    );
    expect(scanProgressText({ ...progress, phase: 'done', filesDone: 40 })).toBe(
      'Scan finished: 40 of 40 files'
    );
  });

  it('reports the failure of a scan instead of its counters', () => {
    expect(scanProgressText({ ...progress, error: 'no such directory' })).toBe(
      'Scan failed: no such directory'
    );
  });

  it('adds a folder that belongs to an account', () => {
    const body = newFolderBody('/srv/music', ' Music ', true, {
      generic: false,
      owner: 'us_1'
    });

    expect(body).toEqual({
      path: '/srv/music',
      name: 'Music',
      watch: true,
      owner: 'us_1',
      generic: null
    });
  });

  it('adds a generic folder without an owner and without a name of its own', () => {
    const body = newFolderBody(' /srv/music ', '', false, { generic: true, owner: 'us_1' });

    expect(body).toEqual({
      path: '/srv/music',
      name: null,
      watch: false,
      owner: null,
      generic: true
    });
  });

  it('moves a folder between its owner and nobody', () => {
    expect(folderPatchBody('Music', false, { generic: true, owner: 'us_1' })).toEqual({
      name: 'Music',
      watch: false,
      owner: null,
      generic: true
    });
    expect(folderPatchBody('Music', true, { generic: false, owner: 'us_2' })).toEqual({
      name: 'Music',
      watch: true,
      owner: 'us_2',
      generic: null
    });
  });
});

describe('lastScanText', () => {
  const NOW = Date.parse('2026-10-21T18:00:00.000Z');

  it('words a fresh scan as just now and an old one as a date', () => {
    expect(lastScanText(NOW - 20_000, NOW)).toBe('Last scan just now');
    expect(lastScanText(NOW - 2 * 3_600_000, NOW)).toBe('Last scan 2 hours ago');
    expect(lastScanText(NOW - 26 * 3_600_000, NOW)).toBe('Last scan Yesterday');
    expect(lastScanText(NOW - 3 * 86_400_000, NOW)).toBe('Last scan 3 days ago');
    expect(lastScanText(NOW - 30 * 86_400_000, NOW)).toMatch(/^Last scan \d/);
  });

  it('says a folder was never scanned', () => {
    expect(lastScanText(null, NOW)).toBe('Never scanned');
    expect(lastScanText(undefined, NOW)).toBe('Never scanned');
  });
});
