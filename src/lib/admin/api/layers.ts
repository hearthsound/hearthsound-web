/**
 * The layer endpoints the admin views and the setup wizard call.
 *
 * A layer's order is written whole: the body is the instance slugs in the order
 * the layer should try them.
 */
import { nativeClient } from '#lib/api/native';

import { refused, okay } from './result';
import type { AdminResult } from './result';
import type { LayerView } from '../layers';

/**
 * Reads every layer and the order it holds its instances in.
 *
 * @returns The layers, in the order the server lists them.
 */
export async function listLayers(): Promise<AdminResult<LayerView[]>> {
  const answer = await nativeClient.GET('/api/v1/admin/layers');
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not load the layers.');
  }
  return okay(answer.data.layers);
}

/**
 * Writes the order of one layer.
 *
 * @param layer The layer's server name.
 * @param instances The instance slugs in the order the layer should try them.
 * @returns The layer as it is now.
 */
export async function saveLayerOrder(
  layer: string,
  instances: string[]
): Promise<AdminResult<LayerView>> {
  const answer = await nativeClient.PUT('/api/v1/admin/layers/{layer}', {
    params: { path: { layer } },
    body: instances
  });
  if (answer.data === undefined) {
    return refused(answer.error, 'Could not save the layer order.');
  }
  return okay(answer.data);
}
