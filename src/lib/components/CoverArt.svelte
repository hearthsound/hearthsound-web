<!--
  A cover image.

  The image is fetched by the browser itself, so it is a plain same-origin URL
  authenticated by the session cookie. Cover art the server cannot resolve is
  left out instead of breaking the layout.
-->
<script lang="ts">
  import { coverArtUrl } from '#lib/player/stream';

  /** Props of a cover image. */
  interface Props {
    /** The id to pass to `getCoverArt`, or `null` when there is none. */
    coverArt: string | null | undefined;
    /** The requested size in pixels. */
    size?: number;
    /** The alternative text. */
    alt?: string;
  }

  let { coverArt, size = 64, alt = '' }: Props = $props();
</script>

{#if coverArt === null || coverArt === undefined || coverArt === ''}
  <span class="cover cover-missing" style="--cover-size: {size}px" aria-hidden="true"></span>
{:else}
  <img
    class="cover"
    style="--cover-size: {size}px"
    src={coverArtUrl(coverArt, size)}
    {alt}
    loading="lazy"
  />
{/if}

<style>
  .cover {
    display: block;
    width: var(--cover-size);
    height: var(--cover-size);
    border-radius: var(--radius);
    object-fit: cover;
    background: var(--color-bg-sunken);
  }

  .cover-missing {
    border: var(--border-width) solid var(--color-border);
  }
</style>
