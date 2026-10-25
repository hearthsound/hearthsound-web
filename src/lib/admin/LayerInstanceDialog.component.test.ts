/**
 * The instance picker: the configured instances a layer can hold, listed above
 * the row that configures a new one, and what it says when nothing is left to
 * assign.
 */
import { cleanup, fireEvent, render } from '@testing-library/svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LayerInstanceDialog from './LayerInstanceDialog.svelte';
import type { LayerView } from './layers';
import type { ProviderView } from './providers';

/** The layer the dialog adds to. */
const layer: LayerView = { layer: 'catalog', instances: [] };

afterEach(() => {
  cleanup();
});

/**
 * Builds one configured instance.
 *
 * @param slug The instance's slug.
 * @param displayName The name shown for it.
 * @returns The instance.
 */
function provider(slug: string, displayName: string): ProviderView {
  return {
    slug,
    displayName,
    pluginId: 'org.example.catalog',
    enabled: true,
    createdAt: 1,
    updatedAt: 2,
    hostConfig: {},
    serverConfig: {}
  };
}

describe('layer instance picker', () => {
  it('lists the instances that can serve the layer above the create row', async () => {
    const { getByText, container } = render(LayerInstanceDialog, {
      props: {
        layer,
        candidates: [provider('deezer', 'Deezer'), provider('musicbrainz', 'MusicBrainz')],
        onclose: () => {},
        onassign: () => {},
        oncreate: () => {}
      }
    });

    expect(getByText('Deezer')).toBeTruthy();
    expect(getByText('MusicBrainz')).toBeTruthy();
    expect(getByText('Create another instance')).toBeTruthy();
    const text = container.textContent ?? '';
    expect(text.indexOf('MusicBrainz')).toBeLessThan(text.indexOf('Create another instance'));
    expect(text.indexOf('Create another instance')).toBeLessThan(
      text.indexOf('Create new instance')
    );
  });

  it('assigns the instance a reader picks', async () => {
    const onassign = vi.fn();
    const { getByText } = render(LayerInstanceDialog, {
      props: {
        layer,
        candidates: [provider('deezer', 'Deezer')],
        onclose: () => {},
        onassign,
        oncreate: () => {}
      }
    });

    await fireEvent.click(getByText('Deezer'));

    expect(onassign).toHaveBeenCalledWith('deezer');
  });

  it('says so and keeps only the create row when nothing can be assigned', () => {
    const { getByText, queryByText } = render(LayerInstanceDialog, {
      props: {
        layer,
        candidates: [],
        onclose: () => {},
        onassign: () => {},
        oncreate: () => {}
      }
    });

    expect(getByText('No configured instance serves this layer yet.')).toBeTruthy();
    expect(getByText('Create new instance')).toBeTruthy();
    expect(queryByText('Create another instance')).toBeNull();
  });

  it('opens the create form from the last row', async () => {
    const oncreate = vi.fn();
    const { getByText } = render(LayerInstanceDialog, {
      props: {
        layer,
        candidates: [],
        onclose: () => {},
        onassign: () => {},
        oncreate
      }
    });

    await fireEvent.click(getByText('Create new instance'));

    expect(oncreate).toHaveBeenCalledTimes(1);
  });
});
