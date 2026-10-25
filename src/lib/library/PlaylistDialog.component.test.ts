/**
 * Tests for the New Playlist dialog: a name the server would refuse is named in
 * the field, Create waits until the name is usable, and a usable name creates
 * the playlist.
 */
import { cleanup, fireEvent, render, waitFor } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { libraryApi } from '#lib/subsonic/library';
import type { Playlist } from '#lib/subsonic/types';

import PlaylistDialog from './PlaylistDialog.svelte';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/**
 * Renders the dialog over spy props.
 *
 * @param name The name to type into the field before the test goes on.
 * @returns The rendered dialog and its props' spies.
 */
async function renderDialog(name?: string) {
  const created = vi.fn<(playlist: Playlist) => void>();
  const close = vi.fn();
  const rendered = render(PlaylistDialog, { props: { created, close } });
  const field = rendered.getByLabelText('Name') as HTMLInputElement;
  if (name !== undefined) {
    await fireEvent.input(field, { target: { value: name } });
  }
  return { ...rendered, created, close, field };
}

describe('the new playlist dialog', () => {
  it('names a name over the limit in the field and sends nothing', async () => {
    const create = vi.spyOn(libraryApi, 'createPlaylist');
    const { container, field, getByText, getByRole } = await renderDialog('a'.repeat(300));

    await fireEvent.blur(field);

    await waitFor(() =>
      expect(getByText('A playlist name is at most 255 characters.')).toBeTruthy()
    );
    const createButton = getByRole('button', { name: 'Create' }) as HTMLButtonElement;
    expect(createButton.disabled).toBe(true);

    await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(create).not.toHaveBeenCalled();
  });

  it('creates the playlist a usable name asks for', async () => {
    const playlist: Playlist = { id: 'pl_1', name: 'Road Trip', songCount: 0 };
    const create = vi.spyOn(libraryApi, 'createPlaylist').mockResolvedValue(playlist);
    const { container, created } = await renderDialog('Road Trip');

    await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() => expect(created).toHaveBeenCalledWith(playlist));
    expect(create).toHaveBeenCalledWith('Road Trip');
  });

  it('says what the server refused in the field instead of a toast', async () => {
    vi.spyOn(libraryApi, 'createPlaylist').mockRejectedValue(new Error('the name is taken'));
    const { container, getByText } = await renderDialog('Road Trip');

    await fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    await waitFor(() =>
      expect(getByText('Could not create the playlist: the name is taken')).toBeTruthy()
    );
  });
});
