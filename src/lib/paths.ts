/**
 * Readable entity paths and the links built from them.
 *
 * An artist and an album each have one URL, built from names rather than ids:
 * `/artist/radiohead`, `/album/radiohead/in-rainbows`, and
 * `/artist/radiohead/top-songs` for the complete list. The server resolves the
 * path to the entity, so the address a reader sees is the same whatever plugins
 * the server runs and whatever the entity's id happens to be.
 *
 * Every link that opens an artist or an album goes through this module. A list
 * answer already carries the segments it needs - the vendor member's `path`,
 * `artistPath` and `albumPath` - so a link costs no request; only the canonical
 * form of a path with two identical names needs one, and the page asks for it
 * when it opens.
 *
 * The ids still matter to the page that reads the entity: a path names the
 * entity, not the payload. {@link rememberTarget} keeps the id the click was
 * made on against the path it led to, so the page can read the entity through
 * the very id the card carried instead of resolving the path again, and
 * {@link openById} resolves an id whose entity has no path to hand.
 */
import { resolve } from '$app/paths';

import { clientRoute, navigate } from '#lib/navigation';
import { toasts } from '#lib/stores/toasts.svelte';
import { libraryApi } from '#lib/subsonic/library';
import type { Child, HearthsoundMember } from '#lib/subsonic/types';

/** How many id-to-path memories are kept before the oldest is dropped. */
const TARGET_MEMORY = 256;

/**
 * The id each recently opened path led to, keyed by the path's pathname.
 *
 * A page reads the id the click carried, so a card's link opens the entity
 * without resolving the path again.
 */
const targets = new Map<string, string>();

/** The parts of an artist an artist link is built from. */
export interface ArtistPathSource {
  /** The artist's display name. */
  name?: string;
  /** The vendor member, which carries the server's segment. */
  hearthsound?: HearthsoundMember;
}

/** The parts of an album an album link is built from. */
export interface AlbumPathSource {
  /** The album's title. */
  name?: string;
  /** The album's title, as a child object spells it. */
  title?: string;
  /** The album's display artist. */
  artist?: string;
  /** The vendor member, which carries the server's path. */
  hearthsound?: HearthsoundMember;
}

/**
 * Normalizes a pathname for the target memory.
 *
 * A trailing slash names the same page as the path without it, so both are
 * remembered under one key.
 *
 * @param pathname The pathname to normalize.
 * @returns The pathname without a trailing slash.
 */
function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

/**
 * Returns the pathname a client route resolves to.
 *
 * A client route is written without the deployment's base path, and a page's
 * pathname carries it, so both sides of the memory are compared as the browser
 * spells them.
 *
 * @param route The client route, for example `/album/radiohead/in-rainbows`.
 * @returns The pathname, with the base path in front of it.
 */
function pathnameOf(route: string): string {
  return normalizePath(new URL(resolve(clientRoute(route)), 'http://hearthsound.invalid').pathname);
}

/**
 * Builds an artist's page path from the server's segment.
 *
 * @param path The segment, for example `radiohead`.
 * @returns The route, or `undefined` for an empty path.
 */
export function artistHrefFromPath(path: string): string | undefined {
  return path === '' ? undefined : `/artist/${encodeURIComponent(path)}`;
}

/**
 * Builds an album's page path from the server's path.
 *
 * @param path The path, for example `radiohead/in-rainbows`.
 * @returns The route, or `undefined` when the path is not an artist and an
 *   album segment.
 */
export function albumHrefFromPath(path: string): string | undefined {
  const parts = path.split('/');
  if (parts.length !== 2 || parts[0] === '' || parts[1] === '') {
    return undefined;
  }
  return `/album/${encodeURIComponent(parts[0])}/${encodeURIComponent(parts[1])}`;
}

/**
 * Builds an artist's page path.
 *
 * The server's segment is preferred; a payload without a vendor member builds
 * one from the name, which the server resolves the same way.
 *
 * @param artist The artist.
 * @returns The route.
 */
export function artistHref(artist: ArtistPathSource): string {
  return (
    artistHrefFromPath(artist.hearthsound?.path ?? '') ??
    `/artist/${encodeURIComponent(artist.name ?? '')}`
  );
}

/**
 * Builds an album's page path.
 *
 * The server's path is preferred; a payload without a vendor member builds one
 * from the album's artist and title, which the server resolves the same way.
 *
 * @param album The album.
 * @returns The route.
 */
export function albumHref(album: AlbumPathSource): string {
  return (
    albumHrefFromPath(album.hearthsound?.path ?? '') ??
    `/album/${encodeURIComponent(album.artist ?? '')}/${encodeURIComponent(album.name ?? album.title ?? '')}`
  );
}

/**
 * Builds the path of the artist a song is credited to.
 *
 * @param song The song.
 * @returns The route, or `undefined` when the song credits no artist.
 */
export function songArtistHref(song: Child): string | undefined {
  return (
    artistHrefFromPath(song.hearthsound?.artistPath ?? '') ??
    (song.artist === undefined || song.artist === '' ? undefined : artistHrefFromPath(song.artist))
  );
}

/**
 * Builds the path of the album a song belongs to.
 *
 * @param song The song.
 * @returns The route, or `undefined` when the song belongs to no album.
 */
export function songAlbumHref(song: Child): string | undefined {
  const path = albumHrefFromPath(song.hearthsound?.albumPath ?? '');
  if (path !== undefined) {
    return path;
  }
  if (song.album === undefined || song.album === '' || song.artist === undefined) {
    return undefined;
  }
  return `/album/${encodeURIComponent(song.artist)}/${encodeURIComponent(song.album)}`;
}

/**
 * Builds the path of an artist's complete top songs list.
 *
 * @param artist The artist's page path.
 * @returns The route.
 */
export function topSongsHref(artist: string): string {
  return `${artist}/top-songs`;
}

/**
 * Remembers which entity a path was opened for.
 *
 * @param route The client route the click led to.
 * @param id The entity's client id, or an empty string when the payload
 *   carried none.
 */
export function rememberTarget(route: string, id: string): void {
  if (id === '') {
    return;
  }
  const key = pathnameOf(route);
  targets.delete(key);
  targets.set(key, id);
  if (targets.size > TARGET_MEMORY) {
    const oldest = targets.keys().next();
    if (!oldest.done) {
      targets.delete(oldest.value);
    }
  }
}

/**
 * Returns the entity a path was opened for.
 *
 * @param pathname The pathname the browser shows.
 * @returns The entity's client id, or `undefined` when the page was opened
 *   without a click that carried one (a shared link, a reload, an entry typed
 *   into the address bar).
 */
export function targetOf(pathname: string): string | undefined {
  return targets.get(normalizePath(pathname));
}

/**
 * Starts listening for entity link clicks, so their ids are remembered.
 *
 * Links carry the entity's id in `data-entity-id`; the listener runs before the
 * router handles the click, which is what lets the page it opens read the
 * entity through the id the card already had.
 *
 * @returns The function that stops the listening.
 */
export function installTargetCapture(): () => void {
  if (typeof document === 'undefined') {
    return () => {};
  }
  const listener = (event: MouseEvent): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    const anchor = target.closest('a[data-entity-id]');
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }
    rememberTarget(anchor.pathname, anchor.dataset.entityId ?? '');
  };
  document.addEventListener('click', listener, true);
  return () => document.removeEventListener('click', listener, true);
}

/**
 * Opens an entity page for the id a link carries.
 *
 * @param route The entity's page path.
 * @param id The entity's client id, or an empty string to resolve the path.
 */
export function openEntity(route: string, id: string): void {
  rememberTarget(route, id);
  void navigate(route);
}

/**
 * Opens the page an id names.
 *
 * A queue item the server sent carries ids but not the segments its page needs,
 * so its path is asked for when the reader opens it. Nothing remembers an id
 * whose entity names no page.
 *
 * @param id The entity's client id.
 * @param go How to open the route; navigates when not given.
 */
export async function openById(
  id: string,
  go: (route: string) => void = (route) => void navigate(route)
): Promise<void> {
  const resolved = await libraryApi.resolve({ id }).catch(() => null);
  const route =
    resolved === null
      ? undefined
      : resolved.type === 'artist'
        ? artistHrefFromPath(resolved.path)
        : albumHrefFromPath(resolved.path);
  if (resolved === null || route === undefined) {
    toasts.push('Could not open this page.', 'error');
    return;
  }
  rememberTarget(route, resolved.id);
  go(route);
}
