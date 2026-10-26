<!--
  The Top Result card on Search (p18).

  The card links to the entity, shows its 96 px art, its name in the display
  face and the muted "<Kind> - <artist>" line, and has a 44 px acid play disc
  at the bottom right. The card link's name is the entity and its kind; the
  disc is a separate target after it.

  Usage:
  `<TopResultCard name="Blue Hour" kind="Album" artist="Marlowe Fenn"
    href="/album/marlowe-fenn/blue-hour" target="al_12" art={coverUrl}
    onplay={play} />`

  A song has no page of its own, so its card links to the album or artist that
  carries it, and a song with neither is not a link.
-->
<script lang="ts">
  import type { IconName } from '@hearthsound/design/icons';

  import { routeHref } from '#lib/navigation';

  import Icon from './Icon.svelte';

  /** Props of the card. */
  interface Props {
    /** The entity's name. */
    name: string;
    /** The entity's kind, e.g. "Album" or "Artist". */
    kind: string;
    /** The artist the kind line names. */
    artist: string;
    /** The entity's page; without one the card is not a link. */
    href?: string;
    /**
     * The id of the entity the page opens, so the page it opens reads the
     * entity without resolving the path again.
     */
    target?: string;
    /** The cover image URL; the entity's tile shows when absent. */
    art?: string;
    /** The entity's icon for the missing-art tile; an album when not given. */
    icon?: IconName;
    /** Starts the entity; the play disc is left out when absent. */
    onplay?: () => void;
  }

  let { name, kind, artist, href, target, art, icon = 'adwaita-album', onplay }: Props = $props();
</script>

<div class="hs-top-result">
  {#if href !== undefined}
    <a class="hs-card__link" href={routeHref(href)} data-entity-id={target}>
      <span class="hs-visually-hidden">{name}, {kind} - {artist}</span>
    </a>
  {/if}
  <span class="hs-top-result__art">
    {#if art !== undefined && art !== ''}
      <img src={art} alt="" loading="lazy" />
    {:else}
      <span class="hs-art-placeholder">
        <Icon name={icon} />
      </span>
    {/if}
  </span>
  <span class="hs-top-result__name" class:clear={onplay !== undefined}>{name}</span>
  <span class="hs-top-result__meta" class:clear={onplay !== undefined}>{kind} - {artist}</span>
  {#if onplay !== undefined}
    <button class="hs-play-button play" type="button" aria-label="Play {name}" onclick={onplay}>
      <Icon name="adwaita-play" />
    </button>
  {/if}
</div>

<style>
  .play {
    z-index: 2;
  }

  /*
   * Layout glue: the 44 px play disc sits in the bottom right corner, so a long
   * name or meta line would run under it. The text keeps the disc's width plus
   * the 12 px gap free on its right.
   */
  .clear {
    padding-inline-end: calc(44px + var(--hs-space-4));
  }
</style>
