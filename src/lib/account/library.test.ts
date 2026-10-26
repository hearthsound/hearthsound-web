/**
 * Tests for the save-location calls: the three routes, the value the settings
 * answer holds, and how a refused request is worded.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { nativeClient } from '#lib/api/native';

import { listSaveFolders, readSaveFolder, writeSaveFolder } from './library';

afterEach(() => {
  vi.restoreAllMocks();
});

/** One folder the account owns, as the server lists it. */
const FOLDER = { id: 'lf_1', name: 'Music', path: '/media/music' };

describe('the folder picker', () => {
  it('reads the folders the account owns', async () => {
    const get = vi.spyOn(nativeClient, 'GET').mockResolvedValue({
      data: { folders: [FOLDER] },
      response: new Response()
    } as never);

    expect(await listSaveFolders()).toEqual({ ok: true, value: [FOLDER] });
    expect(get).toHaveBeenCalledWith('/api/v1/me/folders');
  });

  it('answers the refusal the server worded', async () => {
    vi.spyOn(nativeClient, 'GET').mockResolvedValue({
      data: undefined,
      error: { code: 'internal', detail: 'The folders could not be read.' },
      response: new Response(null, { status: 500 })
    } as never);

    expect(await listSaveFolders()).toEqual({
      ok: false,
      message: 'The folders could not be read.'
    });
  });

  it('answers a refusal for a request that never reached the server', async () => {
    vi.spyOn(nativeClient, 'GET').mockRejectedValue(new Error('offline'));

    expect(await listSaveFolders()).toEqual({ ok: false, message: 'Could not read the folders.' });
    expect(await readSaveFolder()).toEqual({ ok: false, message: 'Could not read the settings.' });
  });
});

describe('the stored choice', () => {
  it('picks the save folder out of the settings', async () => {
    vi.spyOn(nativeClient, 'GET').mockResolvedValue({
      data: {
        settings: [
          {
            key: 'library.confirm_folder_removal',
            value: true,
            source: 'user',
            serverValue: true,
            description: ''
          },
          {
            key: 'library.save_folder',
            value: 'lf_1',
            source: 'user',
            serverValue: '',
            description: ''
          }
        ]
      },
      response: new Response()
    } as never);

    expect(await readSaveFolder()).toEqual({ ok: true, value: 'lf_1' });
  });

  it('reads an empty or absent value as the managed library', async () => {
    vi.spyOn(nativeClient, 'GET').mockResolvedValue({
      data: {
        settings: [
          {
            key: 'library.save_folder',
            value: '',
            source: 'server',
            serverValue: '',
            description: ''
          }
        ]
      },
      response: new Response()
    } as never);
    expect(await readSaveFolder()).toEqual({ ok: true, value: null });

    vi.spyOn(nativeClient, 'GET').mockResolvedValue({
      data: { settings: [] },
      response: new Response()
    } as never);
    expect(await readSaveFolder()).toEqual({ ok: true, value: null });
  });
});

describe('storing the choice', () => {
  it('patches the setting with the folder it names', async () => {
    const patch = vi.spyOn(nativeClient, 'PATCH').mockResolvedValue({
      data: { settings: [] },
      response: new Response()
    } as never);

    expect(await writeSaveFolder('lf_1')).toEqual({ ok: true, value: undefined });
    expect(patch).toHaveBeenCalledWith('/api/v1/me/settings', {
      body: { settings: { 'library.save_folder': 'lf_1' } }
    });
  });

  it('removes the override for the managed library', async () => {
    const patch = vi.spyOn(nativeClient, 'PATCH').mockResolvedValue({
      data: { settings: [] },
      response: new Response()
    } as never);

    expect(await writeSaveFolder(null)).toEqual({ ok: true, value: undefined });
    expect(patch).toHaveBeenCalledWith('/api/v1/me/settings', {
      body: { settings: { 'library.save_folder': null } }
    });
  });

  it('names the folder rule when the server refused one', async () => {
    vi.spyOn(nativeClient, 'PATCH').mockResolvedValue({
      data: undefined,
      error: {
        code: 'invalid-request',
        detail: '`library.save_folder` must name a scanned folder you own.'
      },
      response: new Response(null, { status: 400 })
    } as never);

    expect(await writeSaveFolder('lf_other')).toEqual({
      ok: false,
      message: '`library.save_folder` must name a scanned folder you own.'
    });
  });

  it('answers a refusal for a request that never reached the server', async () => {
    vi.spyOn(nativeClient, 'PATCH').mockRejectedValue(new Error('offline'));

    expect(await writeSaveFolder('lf_1')).toEqual({
      ok: false,
      message: 'Could not save this location.'
    });
  });
});
