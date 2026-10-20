<!--
  A playlist's mosaic cover (k16).

  One, two, three or four covers fill the cover box; the first cover is the
  tall half for three. With no covers the tonal tile carries the playlist
  icon. The mosaic fills and inherits the corner radius of its cover box.

  Usage: `<span class="hs-card__cover"><Mosaic covers={playlist.covers} /></span>`
-->
<script lang="ts">
  import Icon from './Icon.svelte';

  /** Props of the mosaic. */
  interface Props {
    /** The image URLs, at most four; missing entries are ignored. */
    covers?: (string | null | undefined)[];
  }

  let { covers = [] }: Props = $props();

  const shown = $derived(
    covers
      .filter((cover): cover is string => cover !== null && cover !== undefined && cover !== '')
      .slice(0, 4)
  );
</script>

{#if shown.length === 0}
  <span class="hs-art-placeholder">
    <Icon name="adwaita-playlist" />
  </span>
{:else}
  <span class="hs-mosaic hs-mosaic--{shown.length}">
    {#each shown as cover, index (index)}
      <img src={cover} alt="" loading="lazy" />
    {/each}
  </span>
{/if}
