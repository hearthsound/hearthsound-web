<!--
  One server setting.

  The editor suits the shape of the value: a switch for a boolean, a number
  field for a count, a text field for a string and a textarea for a list, one
  item per line. A key the configuration file or the environment pins is shown
  read-only, because a value written to the database would not apply; every
  other key is saved on its own, and Reset removes the stored value so the
  layers below apply again.
-->
<script lang="ts">
  import { untrack } from 'svelte';

  import { nativeClient } from '#lib/api/native';

  import { problemMessage } from './problem';
  import { settingPatch, settingText, settingValue } from './settings';
  import type { ServerSetting } from './settings';

  /** Props of the field. */
  interface Props {
    /** The setting to edit. */
    setting: ServerSetting;
    /** Receives every setting the server answered with after a change. */
    onchanged: (settings: ServerSetting[]) => void;
  }

  let { setting, onchanged }: Props = $props();

  const value: unknown = $derived(setting.value);
  const readOnly = $derived(setting.pinned || setting.environmentPinned);
  const origin = $derived(
    setting.pinned
      ? 'Set in the configuration file'
      : setting.environmentPinned
        ? 'Set by the environment'
        : null
  );
  const isNumber = $derived(setting.kind === 'integer' || setting.kind === 'float');

  let text = $state(untrack(() => settingText(setting)));
  let failure = $state<string | null>(null);
  let busy = $state(false);

  /**
   * Stores one value for this setting, or removes the stored one.
   *
   * @param next The value to store, or `null` to remove it.
   */
  async function send(next: unknown): Promise<void> {
    busy = true;
    const answer = await nativeClient.PATCH('/api/v1/admin/settings', {
      body: settingPatch(setting.key, next)
    });
    busy = false;
    if (answer.data === undefined) {
      failure = problemMessage(answer.error, 'Could not save the setting.');
      return;
    }
    failure = null;
    const updated = answer.data.settings.find((entry) => entry.key === setting.key);
    if (updated !== undefined) {
      text = settingText(updated);
    }
    onchanged(answer.data.settings);
  }
</script>

<div class="setting">
  <div class="heading">
    <code class="key">{setting.key}</code>
    <p class="description">{setting.description}</p>
  </div>

  {#if readOnly}
    <p class="value">{text}</p>
    <p class="hint">{origin}</p>
  {:else if setting.kind === 'bool'}
    <label class="checkbox">
      <input
        type="checkbox"
        checked={value === true}
        disabled={busy}
        onchange={(event) => void send(event.currentTarget.checked)}
      />
      <span>{value === true ? 'On' : 'Off'}</span>
    </label>
  {:else}
    {#if setting.kind === 'stringList'}
      <textarea class="input" rows="3" bind:value={text} disabled={busy}></textarea>
    {:else}
      <input
        class="input"
        type={isNumber ? 'number' : 'text'}
        step={setting.kind === 'float' ? 'any' : undefined}
        bind:value={text}
        disabled={busy}
      />
    {/if}

    <div class="commands">
      <button
        class="primary"
        type="button"
        onclick={() => void send(settingValue(setting.kind, text))}
        disabled={busy}
      >
        Save
      </button>
      <button type="button" onclick={() => void send(null)} disabled={busy}>Reset</button>
    </div>
  {/if}

  {#if failure !== null}
    <p class="failure" role="alert">{failure}</p>
  {/if}
</div>

<style>
  .setting {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
    padding: var(--space-3);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .heading {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
    align-items: baseline;
  }

  .key {
    font-family: var(--font-mono);
    font-size: 0.875rem;
  }

  .description {
    flex: 1 1 16rem;
    margin: 0;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .value {
    margin: 0;
    font-family: var(--font-mono);
  }

  .hint {
    margin: 0;
    color: var(--color-fg-muted);
    font-size: 0.875rem;
  }

  .input {
    padding: var(--space-2);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
  }

  .input:disabled {
    color: var(--color-fg-muted);
    background: var(--color-bg-sunken);
  }

  .checkbox {
    display: flex;
    gap: var(--space-2);
    align-items: center;
  }

  .commands {
    display: flex;
    gap: var(--space-2);
  }

  .commands button {
    padding: var(--space-1) var(--space-3);
    color: var(--color-fg);
    font: inherit;
    background: var(--color-bg);
    border: var(--border-width) solid var(--color-border);
    border-radius: var(--radius);
    cursor: pointer;
  }

  .commands button.primary {
    color: var(--color-accent-fg);
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  .commands button:disabled {
    opacity: 0.6;
    cursor: default;
  }

  .failure {
    margin: 0;
    color: var(--color-danger);
  }
</style>
