<!--
  The permissions one plugin asks for, with the risk each grant carries.

  An administrator reads this before approving a plugin for the first time, and
  approves an upgrade that asks for more than the installed version holds.
-->
<script lang="ts">
  import type { PluginView } from './plugins';
  import { riskLabel, sourceLabel } from './plugins';

  /** Props of the list. */
  interface Props {
    /** The plugin whose permissions are shown. */
    plugin: PluginView;
  }

  let { plugin }: Props = $props();
</script>

<div class="permissions">
  <p class="summary">
    {plugin.name} ({plugin.id}) version {plugin.version}, from {sourceLabel(plugin.source)}.
  </p>

  {#if plugin.requestedPermissions.length === 0}
    <p class="summary">It asks for no permissions beyond running.</p>
  {:else}
    <ul class="list">
      {#each plugin.requestedPermissions as permission (permission.scope)}
        <li class="permission">
          <span class="scope">{permission.scope}</span>
          <span class="detail">{permission.detail}</span>
          <span class="risk risk-{permission.risk}">{riskLabel(permission.risk)}</span>
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .permissions {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .summary {
    margin: 0;
    color: var(--color-fg-muted);
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .permission {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: baseline;
    padding: var(--space-2);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .scope {
    font-family: var(--font-mono);
  }

  .detail {
    flex: 1 1 12rem;
  }

  .risk {
    padding: 0 var(--space-1);
    font-size: 0.75rem;
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .risk-high {
    color: var(--color-danger);
    border-color: var(--color-danger);
  }

  .risk-medium {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }
</style>
