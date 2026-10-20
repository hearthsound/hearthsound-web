<!--
  One row in a BoxedList (k11-r1).

  The row is a button when it acts, a link when it navigates and a plain row
  otherwise. Its trailing element is whatever the page passes as children, so
  a switch, a pill or a menu button sits at the end of the same anatomy. A
  settings row carries its key as `data-setting` and shows no key line.

  An interactive row with a subtitle uses the title as its name and the
  subtitle as its description. An expander row opens with Right and closes
  with Left.

  Usage: `<ListRow title="Transcoding" subtitle="Convert lossless audio."
    setting="playback.transcoding" interactive><input type="checkbox" ... /></ListRow>`
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';
  import type { Snippet } from 'svelte';

  import Icon from './Icon.svelte';

  /** Props of a row. */
  interface Props {
    /** The row's title, or a property row's key. */
    title: string;
    /** The muted second line. */
    subtitle?: string;
    /** The muted value at the end, before the trailing control. */
    value?: string;
    /** The setting key, written as `data-setting` for the tests. */
    setting?: string;
    /** The leading icon. */
    icon?: IconName;
    /** A pinned note under the subtitle, marked with a lock; the row shows it muted. */
    pinned?: string;
    /** Renders the comfortable row at the compact admin height. */
    compact?: boolean;
    /** Indents the row under an expander. */
    nested?: boolean;
    /** Renders a centred, weight-600 button row. */
    button?: boolean;
    /** Renders a property row: a muted key line over the value. */
    property?: boolean;
    /** Renders an expander row with a trailing chevron that turns when open. */
    expander?: boolean;
    /** Whether the expander is open. */
    expanded?: boolean;
    /** Draws the row's hover and press tones; set it for a row whose control sits inside. */
    interactive?: boolean;
    /** Whether the row is unavailable. */
    disabled?: boolean;
    /** The page to navigate to; the row becomes a link. */
    href?: string;
    /** Runs when the row is chosen; the row becomes a button. */
    onclick?: () => void;
    /** The trailing control, e.g. a switch, a pill or a menu button. */
    children?: Snippet;
  }

  let {
    title,
    subtitle,
    value,
    setting,
    icon,
    pinned,
    compact = false,
    nested = false,
    button = false,
    property = false,
    expander = false,
    expanded,
    interactive = false,
    disabled = false,
    href,
    onclick,
    children
  }: Props = $props();

  const id = $props.id();
  const subtitleId = `${id}-subtitle`;
  const pinnedId = `${id}-pinned`;
  const describedby = $derived(
    [subtitle !== undefined ? subtitleId : '', pinned !== undefined ? pinnedId : '']
      .filter((part) => part !== '')
      .join(' ') || undefined
  );

  const tag = $derived(href !== undefined ? 'a' : onclick !== undefined ? 'button' : 'div');
  const twoLine = $derived(subtitle !== undefined || pinned !== undefined);
  const active = $derived(interactive || onclick !== undefined || href !== undefined);
  const classes = $derived(
    [
      'hs-setting-row',
      twoLine && 'hs-setting-row--two-line',
      button && 'hs-setting-row--button',
      property && 'hs-setting-row--property',
      expander && 'hs-setting-row--expander',
      nested && 'hs-setting-row--nested',
      compact && 'hs-setting-row--compact',
      active && 'hs-setting-row--interactive'
    ]
      .filter((name) => name !== false)
      .join(' ')
  );
  const control = $derived(tag !== 'div');

  /**
   * Runs the row's command unless the row is disabled.
   *
   * @param event The click on the row.
   */
  function activate(event: MouseEvent): void {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onclick?.();
  }

  /**
   * Opens and closes an expander row with the horizontal arrows.
   *
   * @param event The key press on the row.
   */
  function keydown(event: KeyboardEvent): void {
    if (!expander || expanded === undefined || disabled) {
      return;
    }
    if (event.key === 'ArrowRight' && !expanded) {
      event.preventDefault();
      onclick?.();
    }
    if (event.key === 'ArrowLeft' && expanded) {
      event.preventDefault();
      onclick?.();
    }
  }
</script>

<svelte:element
  this={tag}
  class={classes}
  class:row-control={control}
  href={tag === 'a' ? (disabled ? undefined : href) : undefined}
  type={tag === 'button' ? 'button' : undefined}
  role={control ? (tag === 'a' ? 'link' : 'button') : undefined}
  data-setting={setting}
  aria-disabled={disabled || undefined}
  aria-expanded={expander ? expanded : undefined}
  aria-label={control ? title : undefined}
  aria-describedby={control ? describedby : undefined}
  onclick={onclick === undefined ? undefined : activate}
  onkeydown={expander ? keydown : undefined}
>
  {#if icon !== undefined}
    <Icon name={icon} class="hs-setting-row__icon" />
  {/if}

  {#if property}
    <span class="hs-setting-row__text">
      <span class="hs-setting-row__key">{title}</span>
      {#if value !== undefined}
        <span>{value}</span>
      {/if}
    </span>
  {:else if button}
    <span>{title}</span>
  {:else}
    <span class="hs-setting-row__text">
      <span>{title}</span>
      {#if subtitle !== undefined}
        <span class="hs-setting-row__subtitle" id={subtitleId}>
          {subtitle}
        </span>
      {/if}
      {#if pinned !== undefined}
        <span class="hs-setting-row__subtitle pinned" id={pinnedId}>
          <Icon name="adwaita-lock" size={14} />
          {pinned}
        </span>
      {/if}
    </span>
    {#if value !== undefined}
      <span class="hs-setting-row__value">{value}</span>
    {/if}
  {/if}

  {@render children?.()}

  {#if expander}
    <Icon name="adwaita-expand" class="hs-setting-row__icon" />
  {/if}
</svelte:element>

<style>
  /* A native button or link reset to a plain row; zero specificity, so the
     package's row weight, tones and hover always win. */
  :where(.row-control) {
    width: 100%;
    margin: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: default;
  }

  .pinned {
    display: inline-flex;
    align-items: center;
    gap: var(--hs-row-pad-compact);
  }
</style>
