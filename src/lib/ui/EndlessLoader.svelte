<!--
  Endless loading (k34).

  The next page is requested automatically when the end of the list comes
  within about one screen, and when keyboard focus reaches the last focusable
  item. While it loads, the region is `aria-busy`, the placeholder snippet
  holds the space of the next items inside an aria-hidden wrapper, and a
  polite status reads "Loading...". Reaching the true end shows nothing extra.
  Focus after loading is the list owner's: it puts focus on the first new
  item.

  Usage:
  `<EndlessLoader {onmore} busy={loading} done={exhausted} placeholders={...}>{#snippet placeholders()}...{/snippet}</EndlessLoader>`
-->
<script lang="ts">
  import type { Snippet } from 'svelte';

  /** Props of the endless loader. */
  interface Props {
    /** Requests the next page; the owner sets `busy` while it runs. */
    onmore: () => void;
    /** Whether the next page is loading. */
    busy?: boolean;
    /** Whether the end of the list has been reached. */
    done?: boolean;
    /** The list itself. */
    children?: Snippet;
    /** The k09b placeholders that hold the next items' space. */
    placeholders?: Snippet;
  }

  let { onmore, busy = false, done = false, children, placeholders }: Props = $props();

  const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  let region: HTMLDivElement | undefined = $state();
  let sentinel: HTMLDivElement | undefined = $state();
  let requested = $state(false);

  $effect(() => {
    if (!busy) {
      requested = false;
    }
  });

  /**
   * Asks for the next page once per loading cycle.
   */
  function request(): void {
    if (busy || done || requested) {
      return;
    }
    requested = true;
    onmore();
  }

  $effect(() => {
    if (sentinel === undefined || done) {
      return;
    }
    // Read `busy` so each finished page starts a fresh observation: when the
    // new items still leave the end in view, the observer reports it again.
    void busy;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          request();
        }
      },
      // About one screen of lead time before the end comes into view.
      { rootMargin: '0px 0px 100% 0px' }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  });

  /**
   * Requests the next page when Tab reaches the last focusable item.
   *
   * @param event The focusin event.
   */
  function handleFocusin(event: FocusEvent): void {
    const focusables = region?.querySelectorAll<HTMLElement>(FOCUSABLE);
    if (focusables === undefined || focusables.length === 0) {
      return;
    }
    if (event.target === focusables[focusables.length - 1]) {
      request();
    }
  }
</script>

<div
  class="hs-endless"
  bind:this={region}
  aria-busy={busy ? 'true' : undefined}
  onfocusin={handleFocusin}
>
  {@render children?.()}

  {#if busy && placeholders !== undefined}
    <div class="hs-endless__placeholder" aria-hidden="true">
      {@render placeholders()}
    </div>
  {/if}

  <div class="hs-endless__sentinel" bind:this={sentinel} aria-hidden="true"></div>

  <span class="hs-visually-hidden" role="status">{busy ? 'Loading...' : ''}</span>
</div>

<style>
  /* Layout glue only: the observed sentinel is a hairline at the end. */
  .hs-endless__sentinel {
    height: 1px;
  }
</style>
