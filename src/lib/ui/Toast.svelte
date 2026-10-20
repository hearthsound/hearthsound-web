<!--
  One toast (k20-r3 D, l11d).

  A pill with a state glyph, the message and one flat text action. It never
  takes focus; the five-second lifetime pauses while the pointer or focus is on
  it, and Escape dismisses the newest toast. The region that places a stack of
  these belongs to the shell (`hs-toast-region`, `role="status"` named
  "Messages"), not to this component.

  Usage:
  ```
  <Toast message="Added to Road Trip." onclose={() => toasts.dismiss(id)} />
  ```
-->
<script lang="ts" module>
  /** The attention a toast asks for. */
  export type ToastLevel = 'success' | 'warning' | 'error';
</script>

<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { IconName } from '@hearthsound/design/icons';

  import Icon from './Icon.svelte';

  /** Props of the toast. */
  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'onclose'> {
    /** The message shown. */
    message: string;
    /** The state the glyph and the live-region role follow; success by default. */
    level?: ToastLevel;
    /** The action's text, `Dismiss` when not given. */
    actionLabel?: string;
    /** Runs the action; when absent the action dismisses. */
    onaction?: () => void;
    /** Removes the toast. */
    onclose: () => void;
    /** How long the toast stays visible in milliseconds; `0` keeps it until dismissed. */
    duration?: number;
    /**
     * Whether this is the newest toast, the one Escape dismisses. A stack passes
     * `true` for its last item only.
     */
    newest?: boolean;
  }

  let {
    message,
    level = 'success',
    actionLabel = 'Dismiss',
    onaction,
    onclose,
    duration = 5000,
    newest = true,
    class: extra = '',
    ...rest
  }: Props = $props();

  /** The glyph each state shows. */
  const GLYPHS: Record<ToastLevel, IconName> = {
    success: 'adwaita-check',
    warning: 'adwaita-warning',
    error: 'adwaita-error'
  };

  const glyph = $derived(GLYPHS[level]);
  const role = $derived(level === 'error' ? 'alert' : 'status');

  let timer: ReturnType<typeof setTimeout> | null = null;
  let remaining = untrack(() => duration);
  let startedAt = 0;
  let hovered = $state(false);
  let focused = $state(false);

  /** Starts the lifetime unless it is paused or spent. */
  function start(): void {
    if (timer !== null || remaining <= 0 || duration <= 0) {
      return;
    }
    startedAt = Date.now();
    timer = setTimeout(() => {
      timer = null;
      onclose();
    }, remaining);
  }

  /** Stops the lifetime and keeps how much of it is left. */
  function pause(): void {
    if (timer === null) {
      return;
    }
    clearTimeout(timer);
    timer = null;
    remaining = Math.max(0, remaining - (Date.now() - startedAt));
  }

  /** Starts or stops the lifetime after the pointer or focus moved. */
  function sync(): void {
    if (hovered || focused) {
      pause();
    } else {
      start();
    }
  }

  /** Runs the action, falling back to dismissing the toast. */
  function run(): void {
    if (onaction !== undefined) {
      onaction();
    } else {
      onclose();
    }
  }

  /**
   * Dismisses the newest toast on Escape.
   *
   * @param event The key press.
   */
  function keydown(event: KeyboardEvent): void {
    if (!newest || event.key !== 'Escape' || event.defaultPrevented) {
      return;
    }
    event.preventDefault();
    onclose();
  }

  onMount(() => {
    start();
    return pause;
  });
</script>

<svelte:window onkeydown={keydown} />

<div
  {...rest}
  class="hs-toast {extra}"
  {role}
  onpointerenter={() => {
    hovered = true;
    sync();
  }}
  onpointerleave={() => {
    hovered = false;
    sync();
  }}
  onfocusin={() => {
    focused = true;
    sync();
  }}
  onfocusout={() => {
    focused = false;
    sync();
  }}
>
  <Icon name={glyph} class="hs-toast__glyph" />
  <span class="hs-toast__message">{message}</span>
  <button class="hs-toast__action" type="button" onclick={run}>{actionLabel}</button>
</div>
