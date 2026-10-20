<!--
  The permissions a plugin asks for, one row per grant (p24-r3).

  Each row is the mono scope, the muted detail and the k10 risk pill; the
  list itself carries no surface, so a caller places it in a grey group (the
  Install confirmation) or straight under a plugin's name (its expanded row).

  Usage: `<PermissionList permissions={plugin.requestedPermissions} />`
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import Pill from '#lib/ui/Pill.svelte';
  import type { PillTone } from '#lib/ui/Pill.svelte';

  import { riskLabel } from './plugins';
  import type { PermissionView } from './plugins';

  /** Props of the list. */
  interface Props {
    /** The grants the plugin asks for, in the order the manifest declares them. */
    permissions: readonly PermissionView[];
  }

  let { permissions }: Props = $props();

  /** The pill each risk is drawn with. */
  const RISKS: Record<string, { tone: PillTone; glyph: IconName }> = {
    low: { tone: 'success', glyph: 'adwaita-check' },
    medium: { tone: 'warning', glyph: 'adwaita-warning' },
    high: { tone: 'error', glyph: 'adwaita-error' }
  };

  /**
   * Returns the pill a permission's risk is drawn with.
   *
   * @param risk The risk the manifest declared.
   * @returns The tone and glyph; the neutral unknown pill for a risk this
   *   client does not know.
   */
  function pill(risk: string): { tone: PillTone; glyph: IconName } {
    return RISKS[risk] ?? { tone: 'neutral', glyph: 'custom-unknown' };
  }
</script>

<div class="hs-permission-list">
  {#each permissions as permission (permission.scope)}
    {@const risk = pill(permission.risk)}
    <div class="hs-permission-row">
      <span class="hs-permission-row__scope">{permission.scope}</span>
      <span class="hs-permission-row__detail">{permission.detail}</span>
      <Pill tone={risk.tone} glyph={risk.glyph} label={riskLabel(permission.risk)} />
    </div>
  {/each}
</div>
