<!--
  A playlist card (k15).

  The card is the k13 album card with a k16 mosaic cover and the playlist's
  name and song count. There is no temporary indication: a playlist the web
  client creates is permanent. The card link covers the tile and carries the
  name and count; the play disc is a separate target after it.

  Usage:
  `<PlaylistCard name="Evening Drive" songs={12} href="/playlist/7"
    covers={covers} onplay={() => player.playPlaylist(7)} />`
-->
<script lang="ts">
  import { routeHref } from '#lib/navigation';

  import Icon from './Icon.svelte';
  import Mosaic from './Mosaic.svelte';

  /** Props of the card. */
  interface Props {
    /** The playlist's name. */
    name: string;
    /** How many songs the playlist holds; 1 reads "1 song". */
    songs: number;
    /** The playlist's page. */
    href: string;
    /** Up to four cover image URLs; an empty list shows the empty-playlist tile. */
    covers?: (string | null | undefined)[];
    /** Starts the playlist; the play disc is left out when absent. */
    onplay?: () => void;
  }

  let { name, songs, href, covers = [], onplay }: Props = $props();

  const count = $derived(`${songs} ${songs === 1 ? 'song' : 'songs'}`);
</script>

<div class="hs-card hs-card--playlist">
  <a class="hs-card__link" href={routeHref(href)}>
    <span class="hs-visually-hidden">{name}, {count}</span>
  </a>
  <span class="hs-card__cover">
    <Mosaic {covers} />
    {#if onplay !== undefined}
      <button
        class="hs-play-button hs-card__play"
        type="button"
        aria-label="Play {name}"
        onclick={onplay}
      >
        <Icon name="adwaita-play" />
      </button>
    {/if}
  </span>
  <span class="hs-card__text">
    <span class="hs-card__title">{name}</span>
    <span class="hs-card__artist">{count}</span>
  </span>
</div>
