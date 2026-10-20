<!--
  A button from the design package (k01, k01b, k01d, busy-rule).

  The variant maps to a fill class, the size and shape to the package's size
  and shape modifiers. `pressed` makes it a toggle (`aria-pressed`), `busy`
  swaps the label for the spinner while keeping the size and the accessible
  name, and `menu` adds the trailing chevron of a menu button. Icon-only
  shapes (`circular`, `icon`, `split`) require `label`, which becomes the
  accessible name and is the same text as the tooltip.

  Usage:
  `<Button variant="suggested" onclick={save}>Save Changes</Button>`
  `<Button shape="icon" icon="adwaita-more" label="More Actions" {onclick} />`
-->
<script lang="ts" module>
  /** The fills a button can take. */
  export type ButtonVariant = 'tonal' | 'suggested' | 'destructive' | 'flat';

  /** The two approved heights. */
  export type ButtonSize = 'regular' | 'large';

  /** The shapes; the last three are icon-only. */
  export type ButtonShape = 'regular' | 'pill' | 'circular' | 'icon' | 'split';
</script>

<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  import Icon from './Icon.svelte';

  interface BaseProps extends Omit<HTMLButtonAttributes, 'children' | 'onclick' | 'onkeydown'> {
    /** The fill; tonal when not given. */
    variant?: ButtonVariant;
    /** The height; regular (36 px) when not given. */
    size?: ButtonSize;
    /** The shape; regular when not given. */
    shape?: ButtonShape;
    /** The page-header variant, whose label hides on phones. */
    header?: boolean;
    /** Adds the trailing chevron of a menu button. */
    menu?: boolean;
    /** Whether the menu the button opens is expanded. */
    expanded?: boolean;
    /** The toggle state; omit for a button that is not a toggle. */
    pressed?: boolean;
    /** Whether the button is working; presses are ignored and a spinner shows. */
    busy?: boolean;
    /** The leading icon. */
    icon?: IconName;
    /** A trailing icon other than the menu chevron. */
    trailingIcon?: IconName;
    /** What kind of popup the button opens. */
    haspopup?: 'menu' | 'listbox' | 'dialog';
    /** The accessible name, required by the icon-only shapes. */
    label?: string;
    /** The visible label. */
    children?: Snippet;
    /** Receives the activation, unless the button is busy or disabled. */
    onclick?: (event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }) => void;
    /** Receives key presses, before the menu button's Down handling. */
    onkeydown?: (event: KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement }) => void;
  }

  /**
   * Props of a button. The icon-only shapes cannot be built without a label,
   * because the label is their accessible name.
   */
  type Props = BaseProps &
    (
      | { shape?: 'regular' | 'pill'; label?: string }
      | { shape: 'circular' | 'icon' | 'split'; label: string }
    );

  let {
    variant = 'tonal',
    size = 'regular',
    shape = 'regular',
    header = false,
    menu = false,
    expanded,
    pressed,
    busy = false,
    icon,
    trailingIcon,
    haspopup,
    label,
    children,
    class: extra = '',
    onclick,
    onkeydown,
    type = 'button',
    disabled,
    'aria-label': ariaLabel,
    ...rest
  }: Props = $props();

  const className = $derived(
    [
      'hs-button',
      variant === 'tonal' ? '' : `hs-button--${variant}`,
      size === 'large' ? 'hs-button--large' : '',
      shape === 'regular' ? '' : `hs-button--${shape}`,
      header ? 'hs-button--header' : '',
      menu ? 'hs-button--menu' : '',
      extra
    ]
      .filter(Boolean)
      .join(' ')
  );

  const popup = $derived(haspopup ?? (menu ? 'menu' : undefined));

  /**
   * Reports the activation to the caller, ignoring it while the button is
   * busy or disabled.
   *
   * @param event The click event.
   */
  function handleClick(
    event: MouseEvent & { currentTarget: EventTarget & HTMLButtonElement }
  ): void {
    if (busy || disabled) {
      return;
    }
    onclick?.(event);
  }

  /**
   * Forwards key presses and opens a menu button on Down, as k01 records.
   *
   * @param event The keydown event.
   */
  function handleKeydown(
    event: KeyboardEvent & { currentTarget: EventTarget & HTMLButtonElement }
  ): void {
    onkeydown?.(event);
    if (event.defaultPrevented || event.key !== 'ArrowDown' || popup === undefined) {
      return;
    }
    event.preventDefault();
    event.currentTarget.click();
  }
</script>

<button
  {...rest}
  class={className}
  {type}
  {disabled}
  aria-label={label ?? ariaLabel}
  aria-haspopup={popup}
  aria-expanded={expanded === undefined ? undefined : expanded}
  aria-pressed={pressed}
  aria-busy={busy ? 'true' : undefined}
  onclick={handleClick}
  onkeydown={handleKeydown}
>
  {#if icon}
    <Icon name={icon} class="hs-button__icon" />
  {/if}
  {#if children}
    <span class="hs-button__label">{@render children()}</span>
  {/if}
  {#if menu}
    <Icon name="adwaita-expand" class="hs-button__icon" />
  {:else if trailingIcon}
    <Icon name={trailingIcon} class="hs-button__icon" />
  {/if}
  {#if busy}
    <span class="hs-spinner"></span>
  {/if}
</button>
