<!--
  An artwork image or its missing-art placeholder (f15b, f15c).

  The image is fetched by the browser itself, so it is a plain same-origin URL
  authenticated by the session cookie. It fills the box its caller gives it:
  a card's cover box, a track row's 40 px lead or a hero's art frame.

  The placeholder is not a fallback that appears after a failure, it is what the
  box shows until the image has arrived: a card grid renders its whole first page
  at once, and a hundred blank frames would flash into a hundred pictures one
  slow fetch at a time. The element observes its own visibility, asks the image
  gate for a slot when it comes into view, and shows the picture only once the
  bytes are there. Leaving the page cancels a picture that has not started, and a
  cover the gate refused - no image, a server refusal - keeps the placeholder.
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import { coverArtUrl } from '#lib/player/stream';
  import Icon from '#lib/ui/Icon.svelte';
  import { imageLoader } from '#lib/ui/image-loader';

  /** Props of a cover image. */
  interface Props {
    /** The id to pass to `getCoverArt`, or `null` when there is none. */
    coverArt: string | null | undefined;
    /** The placeholder's entity icon. */
    icon?: IconName;
    /** The requested image size in pixels, as the server's image hint. */
    size?: number;
    /** The alternative text. */
    alt?: string;
    /** The class that sizes the image or the placeholder in its box. */
    class?: string;
  }

  let {
    coverArt,
    icon = 'adwaita-album',
    size = 300,
    alt = '',
    class: extra = ''
  }: Props = $props();

  /** Where the box is: waiting for the image, showing it, or done trying. */
  type Phase = 'waiting' | 'shown' | 'failed';

  let phase = $state<Phase>('waiting');
  let placeholder = $state<HTMLElement | null>(null);
  // Not reactive: it is only read by the cleanup that gives the slot back, and a
  // reactive write inside the effect would re-run it.
  let pending: { cancel(): void } | null = null;

  const url = $derived(
    coverArt === null || coverArt === undefined || coverArt === ''
      ? null
      : coverArtUrl(coverArt, size)
  );

  const ready = $derived(url !== null && imageLoader.isLoaded(url));

  // A new cover id or size is a new image: the box starts waiting again.
  $effect(() => {
    void url;
    phase = 'waiting';
  });

  // The box asks for its image when it comes near the viewport, so a page of a
  // hundred cards never queues a hundred pictures the reader will not scroll to.
  $effect(() => {
    const target = placeholder;
    const source = url;
    if (!target || !source) {
      return;
    }
    if (ready || phase === 'failed') {
      return;
    }
    if (typeof IntersectionObserver === 'undefined') {
      const load = imageLoader.load(source);
      pending = load;
      void load.done.then((ok) => (phase = ok ? 'shown' : 'failed'));
      return () => load.cancel();
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }
        observer.disconnect();
        const load = imageLoader.load(source);
        pending = load;
        void load.done.then((ok) => (phase = ok ? 'shown' : 'failed'));
      },
      { rootMargin: '300px' }
    );
    observer.observe(target);
    return () => {
      observer.disconnect();
      pending?.cancel();
      pending = null;
    };
  });
</script>

{#if ready || phase === 'shown'}
  <img class={extra} src={url ?? ''} {alt} decoding="async" onerror={() => (phase = 'failed')} />
{:else}
  <span class="hs-art-placeholder {extra}" bind:this={placeholder}><Icon name={icon} /></span>
{/if}
