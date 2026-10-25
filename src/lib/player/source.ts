/**
 * What the client knows about the server's acquisition layer.
 *
 * A track the server does not hold can only be fetched when an acquisition
 * instance is configured. While none is, the server parks the request as
 * `queued` and never attempts it, so the player says what it waits for instead
 * of claiming to search for a source (E-G-1).
 */
import type { SystemInfo } from '#lib/stores/session.svelte';

/** The layer a download source is assigned to. */
const ACQUISITION_LAYER = 'acquisition';

/**
 * Reports whether the server can acquire a track at all.
 *
 * An unknown system info counts as configured: saying nothing is better than
 * telling a listener their server has no download source when the client
 * simply has not read the answer yet.
 *
 * @param systemInfo What `/api/v1/system/info` answered, or `null` while the
 *   client has no answer.
 * @returns `true` when a download source may exist.
 */
export function hasAcquisitionSource(systemInfo: SystemInfo | null): boolean {
  if (systemInfo === null) {
    return true;
  }
  return systemInfo.layers.some(
    (layer) => layer.layer === ACQUISITION_LAYER && layer.instances.length > 0
  );
}
