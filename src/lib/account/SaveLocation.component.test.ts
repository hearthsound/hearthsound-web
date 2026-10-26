/**
 * The save-location row: it is drawn only for an account that owns a folder,
 * offers the managed library first, saves the moment the choice changes, and
 * puts the choice back when the server refuses it.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import SaveLocation from './SaveLocation.svelte';
import { listSaveFolders, readSaveFolder, writeSaveFolder } from './library';
import type { MyFolderView } from './library';

vi.mock('./library', async (importOriginal) => {
  const actual = await importOriginal<typeof Library>();
  return {
    ...actual,
    listSaveFolders: vi.fn(),
    readSaveFolder: vi.fn(),
    writeSaveFolder: vi.fn()
  };
});

import type * as Library from './library';

/** One folder the account owns, as the server lists it. */
const FOLDER: MyFolderView = { id: 'lf_1', name: 'Music', path: '/media/music' };

/**
 * Answers the two reads the section makes.
 *
 * @param folders The folders the account owns.
 * @param stored The folder the account saves into, or `null` for the managed
 *   library.
 * @returns Nothing.
 */
function answer(folders: MyFolderView[], stored: string | null): void {
  vi.mocked(listSaveFolders).mockResolvedValue({ ok: true, value: folders });
  vi.mocked(readSaveFolder).mockResolvedValue({ ok: true, value: stored });
}

afterEach(() => {
  cleanup();
  vi.mocked(listSaveFolders).mockReset();
  vi.mocked(readSaveFolder).mockReset();
  vi.mocked(writeSaveFolder).mockReset();
});

describe('the save location', () => {
  it('draws nothing for an account that owns no folder', async () => {
    answer([], null);
    render(SaveLocation);

    await waitFor(() => expect(listSaveFolders).toHaveBeenCalled());
    expect(screen.queryByRole('heading', { name: 'Save Location' })).toBeNull();
    expect(screen.queryByText('Save location')).toBeNull();
  });

  it('offers the managed library and every folder the account owns', async () => {
    answer([FOLDER, { id: 'lf_2', name: 'Singles', path: '/media/singles' }], null);
    render(SaveLocation);

    await waitFor(() => expect(screen.getByText('Save location')).toBeTruthy());
    expect(screen.getByText('Where music you save is written.')).toBeTruthy();

    // The closed control shows the current choice; the list holds all three.
    const control = screen.getByRole('button', { name: /Save location/ });
    expect(control.textContent).toContain('Managed library');

    await fireEvent.click(control);
    expect(screen.getByRole('option', { name: 'Managed library' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Music' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Singles' })).toBeTruthy();
  });

  it('stores the folder the reader picks', async () => {
    answer([FOLDER], null);
    vi.mocked(writeSaveFolder).mockResolvedValue({ ok: true, value: undefined });
    render(SaveLocation);

    await fireEvent.click(await screen.findByRole('button', { name: /Save location/ }));
    await fireEvent.click(screen.getByRole('option', { name: 'Music' }));

    await waitFor(() => expect(writeSaveFolder).toHaveBeenCalledWith('lf_1'));
  });

  it('clears the override for the managed library', async () => {
    answer([FOLDER], 'lf_1');
    vi.mocked(writeSaveFolder).mockResolvedValue({ ok: true, value: undefined });
    render(SaveLocation);

    await fireEvent.click(await screen.findByRole('button', { name: /Save location/ }));
    await fireEvent.click(screen.getByRole('option', { name: 'Managed library' }));

    await waitFor(() => expect(writeSaveFolder).toHaveBeenCalledWith(null));
  });

  it('puts the choice back and names the problem when the save is refused', async () => {
    answer([FOLDER], null);
    vi.mocked(writeSaveFolder).mockResolvedValue({
      ok: false,
      message: '`library.save_folder` must name a scanned folder you own.'
    });
    render(SaveLocation);

    const control = await screen.findByRole('button', { name: /Save location/ });
    await fireEvent.click(control);
    await fireEvent.click(screen.getByRole('option', { name: 'Music' }));

    await waitFor(() =>
      expect(
        screen.getByText('`library.save_folder` must name a scanned folder you own.')
      ).toBeTruthy()
    );
    expect(screen.getByRole('alert').textContent).toContain('library.save_folder');
    // The control keeps the stored choice and stays usable.
    expect(control.getAttribute('aria-disabled')).toBeNull();
    expect(control.textContent).toContain('Managed library');
  });

  it('falls back to the managed library for a stored folder it does not offer', async () => {
    answer([FOLDER], 'lf_gone');
    render(SaveLocation);

    const control = await screen.findByRole('button', { name: /Save location/ });
    expect(control.textContent).toContain('Managed library');
  });
});
