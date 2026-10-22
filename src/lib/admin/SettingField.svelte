<!--
  One server setting in the p26c row shape.

  The readable name (c01) is the row's title and the server's description sits
  below it; a key the configuration file or the environment pins shows that
  origin with a lock and its value at the right, with no control, because a
  value written to the database would not apply. Every other key is edited in
  place: a switch saves the moment it flips, a string setting that accepts a
  fixed set of values is a drop-down of those values, a string list with fixed
  values is a checkbox per value, and a free text or number field shows the
  suggested Save only once it differs from the stored value, saves on Enter and
  cancels on Escape. "Use Default" in the row menu removes the stored value so
  the layers below apply again (c03 item 10). The key itself is only the row's
  `data-setting` attribute (p26-key).
-->
<script lang="ts">
  import { untrack } from 'svelte';

  import { nativeClient } from '#lib/api/native';

  import { problemMessage } from './problem';
  import { settingChoiceLabel, settingName } from './setting-names';
  import { settingPatch, settingText, settingValue } from './settings';
  import type { ServerSetting } from './settings';

  import Button from '#lib/ui/Button.svelte';
  import Checkbox from '#lib/ui/Checkbox.svelte';
  import Icon from '#lib/ui/Icon.svelte';
  import Menu from '#lib/ui/Menu.svelte';
  import MenuItem from '#lib/ui/MenuItem.svelte';
  import NumberField from '#lib/ui/NumberField.svelte';
  import Select from '#lib/ui/Select.svelte';
  import Switch from '#lib/ui/Switch.svelte';
  import TextArea from '#lib/ui/TextArea.svelte';
  import TextField from '#lib/ui/TextField.svelte';

  /** Props of the field. */
  interface Props {
    /** The setting to edit. */
    setting: ServerSetting;
    /** Receives every setting the server answered with after a change. */
    onchanged: (settings: ServerSetting[]) => void;
  }

  let { setting, onchanged }: Props = $props();

  const name = $derived(settingName(setting.key));
  const storedText = $derived(settingText(setting));
  const readOnly = $derived(setting.pinned || setting.environmentPinned);
  const origin = $derived(
    setting.pinned
      ? 'Set in the configuration file'
      : setting.environmentPinned
        ? 'Set by the environment'
        : null
  );
  const numeric = $derived(setting.kind === 'integer');
  /** The values the setting accepts, empty when it accepts any text. */
  const allowed = $derived(setting.allowed ?? []);
  /** The drop-down's choices, with their readable labels. */
  const choices = $derived(allowed.map((value) => ({ value, label: settingChoiceLabel(value) })));
  /** The values a list setting holds now. */
  const chosen = $derived.by(() => {
    const value: unknown = setting.value;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : [];
  });
  const isFloat = $derived(setting.kind === 'float');
  const storedNumber = $derived(numberOf(setting));

  let text = $state(untrack(() => settingText(setting)));
  let number = $state(untrack(() => numberOf(setting) ?? 0));
  let empty = $state(untrack(() => numberOf(setting) === null));
  let failure = $state<string | null>(null);
  let busy = $state(false);

  /** Whether a text field differs from the value the server holds. */
  const textDirty = $derived(text !== storedText);

  /** Whether the number field differs from the value the server holds. */
  const numberDirty = $derived(
    empty ? storedNumber !== null : storedNumber === null || number !== storedNumber
  );

  /** Whether the row holds an unsaved edit, which is what shows Save. */
  const dirty = $derived(numeric ? numberDirty : textDirty);

  $effect(() => {
    // Adopt the answer a save, Use Default or a reload brought in. Typing does
    // not touch the setting, so an effect run never overwrites an edit.
    void setting.value;
    if (!busy) {
      adopt(setting);
    }
  });

  /**
   * Reads the boolean value of a setting.
   *
   * @param source The setting to read.
   * @returns `true` when the value is on.
   */
  function boolOf(source: ServerSetting): boolean {
    const value: unknown = source.value;
    return value === true;
  }

  /**
   * Reads the numeric value of a setting.
   *
   * @param source The setting to read.
   * @returns The value when it is a number, or `null` when the setting has none.
   */
  function numberOf(source: ServerSetting): number | null {
    const value: unknown = source.value;
    return typeof value === 'number' ? value : null;
  }

  /**
   * Makes the row hold the value of one setting again.
   *
   * @param source The setting to read.
   */
  function adopt(source: ServerSetting): void {
    text = settingText(source);
    number = numberOf(source) ?? 0;
    empty = numberOf(source) === null;
  }

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
      adopt(updated);
    }
    onchanged(answer.data.settings);
  }

  /**
   * Saves one value the reader picked from a drop-down.
   *
   * @param next The chosen token.
   */
  function pick(next: string): void {
    text = next;
    void send(next);
  }

  /**
   * Saves the list a reader built from checkboxes.
   *
   * @param value The token whose box changed.
   * @param checked Whether the box is on now.
   */
  function toggle(value: string, checked: boolean): void {
    const next = checked
      ? allowed.filter((candidate) => candidate === value || chosen.includes(candidate))
      : chosen.filter((candidate) => candidate !== value);
    void send(next);
  }

  /**
   * Saves the field's value when it differs from the stored one.
   *
   * @param event The form submission, from Enter or the Save button.
   */
  function submit(event: SubmitEvent): void {
    event.preventDefault();
    if (busy || !dirty) {
      return;
    }
    void send(numeric ? (empty ? null : Math.trunc(number)) : settingValue(setting.kind, text));
  }

  /**
   * Drops the edit on the field and shows the stored value again (Escape).
   *
   * The field is blurred first so the number entry commits nothing before the
   * stored value replaces it.
   *
   * @param event The key press on the field.
   */
  function escape(event: KeyboardEvent): void {
    if (event.key !== 'Escape') {
      return;
    }
    cancel();
  }

  /**
   * Drops the edit on the field and shows the stored value again (Escape).
   *
   * The field is blurred first so the number entry commits nothing before the
   * stored value replaces it.
   */
  function cancel(): void {
    if (busy) {
      return;
    }
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    adopt(setting);
  }
</script>

<div class="hs-setting-row hs-setting-row--two-line setting" data-setting={setting.key}>
  <span class="hs-setting-row__text">
    <span>{name}</span>
    <span class="hs-setting-row__subtitle">{setting.description}</span>
    {#if origin !== null}
      <span class="hs-setting-row__subtitle origin">
        <Icon name="adwaita-lock" size={14} />
        {origin}
      </span>
    {/if}
    {#if failure !== null}
      <span class="hs-setting-row__subtitle hs-setting-row__subtitle--error" role="alert">
        {failure}
      </span>
    {/if}
  </span>

  {#if readOnly}
    <span class="hs-setting-row__value pinned-value">
      {setting.kind === 'stringList'
        ? chosen.map(settingChoiceLabel).join(', ')
        : allowed.length > 0
          ? settingChoiceLabel(text)
          : text}
    </span>
  {:else}
    <span class="control">
      {#if setting.kind === 'bool'}
        <Switch
          label={name}
          checked={boolOf(setting)}
          disabled={busy}
          onchange={(checked) => void send(checked)}
        />
      {:else if setting.kind === 'string' && allowed.length > 0}
        <Select label={name} options={choices} value={text} disabled={busy} onchange={pick} />
      {:else if setting.kind === 'stringList' && allowed.length > 0}
        <span class="checks">
          {#each choices as choice (choice.value)}
            <Checkbox
              label={choice.label}
              checked={chosen.includes(choice.value)}
              disabled={busy}
              onchange={(checked) => toggle(choice.value, checked)}
            />
          {/each}
        </span>
      {:else}
        <form class="form" onsubmit={submit}>
          {#if numeric}
            <NumberField
              label={name}
              bind:value={number}
              bind:empty
              disabled={busy}
              min={0}
              onkeydown={escape}
            />
          {:else if setting.kind === 'stringList'}
            <TextArea label={name} bind:value={text} disabled={busy} onkeydown={escape} />
          {:else}
            <TextField
              label={name}
              bind:value={text}
              disabled={busy}
              inputmode={isFloat ? 'decimal' : undefined}
              onkeydown={escape}
            />
          {/if}

          {#if dirty || busy}
            <Button variant="suggested" type="submit" {busy} disabled={busy}>Save</Button>
          {/if}
        </form>
      {/if}
    </span>

    <Menu label="More Actions" align="end">
      <MenuItem
        label="Use Default"
        icon="adwaita-refresh"
        disabled={busy}
        onselect={() => void send(null)}
      />
    </Menu>
  {/if}
</div>

<style>
  /* Layout glue only: p26c wraps the control under the text on phones and puts
     it at the right otherwise; the package's row has no control column. */
  .setting {
    align-items: center;
  }

  .control {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--hs-space-2);
  }

  .form {
    display: flex;
    align-items: center;
    gap: var(--hs-space-2);
  }

  /* Layout glue only: a list setting's boxes stack under one another and the
     control column keeps room for them. */
  .checks {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  /* Layout glue only: the boards bound a setting's field at about 200 px so the
     text column keeps the row's width; k03 makes a field fill its container. */
  .form :global(.hs-field) {
    width: 200px;
  }

  .origin {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }

  /* Layout glue only: the k07 switch names itself through the row title, so the
     label Switch renders is kept for assistive technology but not drawn. The
     rule names the switch's own root, because a checkbox row uses the same
     class and needs its box and its label. */
  .control :global(div.hs-choice) {
    min-height: 0;
    padding: 0;
    gap: 0;
  }

  .control :global(div.hs-choice > span) {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

  /* Layout glue only: the row's menu keeps the far end of the row on phones,
     where the text takes its own line and the control wraps under it. */
  .setting > :global(.menu-anchor) {
    margin-left: auto;
  }

  /* A pinned value can hold a list; p26c leaves it at the right and wraps it. */
  .pinned-value {
    max-width: 40%;
    text-align: right;
    overflow-wrap: anywhere;
  }

  /* p26c: on phones the text takes the row and the control wraps under it. */
  @media (max-width: 720px) {
    .setting {
      flex-wrap: wrap;
    }

    .setting > :global(.hs-setting-row__text) {
      flex: 1 1 100%;
    }

    .form :global(.hs-field) {
      width: 180px;
    }

    .pinned-value {
      max-width: 100%;
      text-align: left;
    }
  }
</style>
