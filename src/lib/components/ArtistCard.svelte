<!--
  An artist card (k14 B).

  An album card with a round portrait, a centred name and no second line. The
  play disc sits 4 px inside the picture and queues the artist's songs: their
  albums are read first because the artist answer carries albums, not tracks.
-->
<script lang="ts">
  import { resolve } from '$app/paths';

  import CoverArt from '#lib/components/CoverArt.svelte';
  import { clientRoute } from '#lib/navigation';
  import { player } from '#lib/player/player.svelte';
  import { loadCollection } from '#lib/library/queue-source';
  import { toasts } from '#lib/stores/toasts.svelte';
  import type { ArtistID3, Child } from '#lib/subsonic/types';
  import Icon from '#lib/ui/Icon.svelte';

  /** Props of an artist card. */
  interface Props {
    /** The artist to show. */
    artist: ArtistID3;
  }

  let { artist }: Props = $props();

  /** Queues the artist's Top Songs first, then the rest, and starts at the head. */
  async function playArtist(): Promise<void> {
    try {
      const collection = await loadCollection(`artist:${artist.id}`);
      if (collection !== null && collection.items.length > 0) {
        player.play(collection.items, collection.startIndex);
      }
    } catch (error) {
      toasts.push(
        error instanceof Error && error.message !== ''
          ? `Could not play this artist: ${error.message}`
          : 'Could not play this artist.',
        'error'
      );
    }
  }
</script>

<div class="hs-card hs-card--artist">
  <a class="hs-card__link" href={resolve(clientRoute(`/artist/${artist.id}`))}>
    <span class="hs-visually-hidden">{artist.name}</span>
  </a>
  <span class="hs-card__cover">
    <CoverArt coverArt={artist.coverArt} icon="adwaita-artist" />
    <button
      class="hs-play-button hs-card__play"
      type="button"
      aria-label="Play {artist.name}"
      onclick={() => void playArtist()}
    >
      <Icon name="adwaita-play" />
    </button>
  </span>
  <span class="hs-card__text">
    <span class="hs-card__title">{artist.name}</span>
  </span>
</div>
