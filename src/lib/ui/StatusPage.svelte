<!--
  A status page (k22 A).

  Centred in the page: a 64 px icon, a heading, a short explanation and an
  optional action. Failures use `alert`, which announces the page; the inline
  variant keeps an empty playlist compact. The caller picks copy from
  `spec/copy.md`.

  Usage:
  ```
  <StatusPage
    alert
    icon="adwaita-warning"
    title="Could Not Load This Page"
    text="The server did not answer. Try again in a moment."
    action={retrySnippet}
  />
  ```
-->
<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLAttributes } from 'svelte/elements';
  import type { IconName } from '@hearthsound/design/icons';

  import Icon from './Icon.svelte';

  /** Props of the status page. */
  interface Props extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
    /** The 64 px icon from the approved set. */
    icon: IconName;
    /** The heading that names the state. */
    title: string;
    /** The explanation under the heading. */
    text?: string;
    /** Keeps the empty state compact under a page hero (p17). */
    inline?: boolean;
    /** Announces the page assertively, for a failure. */
    alert?: boolean;
    /** The button under the text. */
    action?: Snippet;
    /** Extra content under the explanation. */
    children?: Snippet;
  }

  let {
    icon,
    title,
    text,
    inline = false,
    alert = false,
    action,
    children,
    class: extra = '',
    ...rest
  }: Props = $props();
</script>

<div
  {...rest}
  class="hs-status-page {extra}"
  class:hs-status-page--inline={inline}
  role={alert ? 'alert' : undefined}
>
  <Icon name={icon} size={64} class="hs-status-page__icon" />
  <h1 class="hs-status-page__title">{title}</h1>
  {#if text !== undefined}
    <p class="hs-status-page__text">{text}</p>
  {/if}
  {@render children?.()}
  {#if action}
    <div class="hs-status-page__action">{@render action()}</div>
  {/if}
</div>
