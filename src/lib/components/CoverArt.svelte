<!--
  An artwork image or its missing-art placeholder (f15b, f15c).

  The image is fetched by the browser itself, so it is a plain same-origin URL
  authenticated by the session cookie. It fills the box its caller gives it:
  a card's cover box, a track row's 40 px lead or a hero's art frame. Artwork
  without an image - and an image the server cannot serve - shows the tonal
  placeholder with the entity's Adwaita icon.
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import { coverArtUrl } from '#lib/player/stream';
  import Icon from '#lib/ui/Icon.svelte';

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

  /** The cover id whose image failed, so a new id gets a fresh image. */
  let failed = $state<string | null>(null);

  const shown = $derived(
    coverArt !== null && coverArt !== undefined && coverArt !== '' && failed !== coverArt
  );
</script>

{#if shown}
  <img
    class={extra}
    src={coverArtUrl(coverArt ?? '', size)}
    {alt}
    loading="lazy"
    onerror={() => (failed = coverArt ?? null)}
  />
{:else}
  <span class="hs-art-placeholder {extra}"><Icon name={icon} /></span>
{/if}
