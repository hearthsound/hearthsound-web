/**
 * The k10 pill of an instance's last health check.
 *
 * The server reports whether the check passed and the probe's own line about
 * what it found. A passing check always reads "Ready": the detail is the
 * plugin's free text and belongs in the failure pill, where it says why the
 * instance could not serve. An instance the server has not checked yet reads
 * "Not checked yet" (p25 B, p25b).
 */
import type { IconName } from '@hearthsound/design/icons';

import type { PillTone } from '#lib/ui/Pill.svelte';

/** The health one instance last reported. */
export interface HealthReport {
  /** Whether the probe passed. */
  ok: boolean;
  /** What the probe said; the reason when it failed. */
  detail: string;
}

/** What the pill draws. */
export interface HealthPill {
  /** The state colour. */
  tone: PillTone;
  /** The state glyph. */
  glyph: IconName;
  /** The visible label. */
  label: string;
}

/**
 * Builds the pill of one instance's last health check.
 *
 * @param health The health the server recorded, or `null` when it has none.
 * @returns The tone, glyph and label: "Ready" in success, the failure's line
 *   in error, and "Not checked yet" in neutral.
 */
export function healthPill(health: HealthReport | null | undefined): HealthPill {
  if (health === null || health === undefined) {
    return { tone: 'neutral', glyph: 'custom-unknown', label: 'Not checked yet' };
  }
  if (health.ok) {
    return { tone: 'success', glyph: 'adwaita-check', label: 'Ready' };
  }
  const detail = health.detail.trim();
  return { tone: 'error', glyph: 'adwaita-error', label: detail === '' ? 'Failed' : detail };
}
