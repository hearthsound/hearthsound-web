<!--
  An album card (k13 C).

  A bare tile at rest, a control-tone tile on hover and press, the cover's
  play disc on hover or focus, the name over the artist. The card link covers
  the tile; the play disc is a separate target after it. The disc queues the
  album's tracks when it is pressed.
-->
<script lang="ts">
  import { resolve } from '$app/paths';

  import CoverArt from '#lib/components/CoverArt.svelte';
  import { clientRoute } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import { toasts } from '#lib/stores/toasts.svelte';
  import type { AlbumID3 } from '#lib/subsonic/types';
  import Icon from '#lib/ui/Icon.svelte';

  /** Props of an album card. */
  interface Props {
    /** The album to show. */
    album: AlbumID3;
    /**
     * The second line; the artist when not given. The artist page shows the
     * release year instead (p16-r1).
     */
    subtitle?: string;
  }

  let { album, subtitle }: Props = $props();

  /** Queues the whole album and starts at its first track. */
  async function playAlbum(): Promise<void> {
    try {
      const collection = await loadCollection(`album:${album.id}`);
      if (collection !== null && collection.items.length > 0) {
        player.play(collection.items, collection.startIndex);
      }
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not play this album: ${error.message}`
          : 'Could not play this album.',
        'error'
      );
    }
  }
</script>

<div class="hs-card hs-card--album">
  <a class="hs-card__link" href={resolve(clientRoute(`/album/${album.id}`))}>
    <span class="hs-visually-hidden"
      >{album.name}{subtitle === undefined
        ? album.artist === undefined
          ? ''
          : `, ${album.artist}`
        : subtitle === ''
          ? ''
          : `, ${subtitle}`}</span
    >
  </a>
  <span class="hs-card__cover">
    <CoverArt coverArt={album.coverArt} icon="adwaita-album" />
    <button
      class="hs-play-button hs-card__play"
      type="button"
      aria-label="Play {album.name}"
      onclick={() => void playAlbum()}
    >
      <Icon name="adwaita-play" />
    </button>
  </span>
  <span class="hs-card__text">
    <span class="hs-card__title">{album.name}</span>
    {#if subtitle !== undefined ? subtitle !== '' : album.artist !== undefined}
      <span class="hs-card__artist">{subtitle ?? album.artist}</span>
    {/if}
  </span>
</div>
