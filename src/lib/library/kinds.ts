/**
 * The views the library offers.
 *
 * One registry states everything a library view has: the segment of its route,
 * the heading it renders, the icon its sidebar row leads with and, for a view
 * whose Play action queues a collection, the collection the server is asked
 * for. The sidebar derives its Library section from this list, so a view is
 * declared once and the navigation follows.
 *
 * The routes name their view in the URL (`/library/songs`, `/library/albums`),
 * and a route that carries a segment no view names is answered with nothing to
 * show instead of an empty list.
 */
import type { IconName } from '@hearthsound/design/icons';

import type { QueueSource } from './queue-source';

/** The views a library route may name. */
export const LIBRARY_KINDS = [
  'songs',
  'albums',
  'artists',
  'liked',
  'playlists',
  'uploads'
] as const;

/** The view a library route names. */
export type LibraryKind = (typeof LIBRARY_KINDS)[number];

/** What one library view is. */
export interface LibraryKindInfo {
  /** The view the entry describes. */
  id: LibraryKind;
  /** The page heading and the sidebar label. */
  title: string;
  /** The 16 px icon the sidebar row leads with. */
  icon: IconName;
  /** The view's route. */
  href: string;
  /** The collection its Play and Shuffle actions queue, when it has one. */
  queueSource?: Extract<QueueSource, 'songs' | 'liked' | 'uploads'>;
  /** Whether the view is offered only where the account may upload (E9, o06). */
  requiresUpload?: boolean;
}

/** Every library view, in sidebar order. */
export const LIBRARY_KIND_INFO: Readonly<Record<LibraryKind, LibraryKindInfo>> = {
  songs: {
    id: 'songs',
    title: 'Songs',
    icon: 'adwaita-song',
    href: '/library/songs',
    queueSource: 'songs'
  },
  albums: {
    id: 'albums',
    title: 'Albums',
    icon: 'adwaita-album',
    href: '/library/albums'
  },
  artists: {
    id: 'artists',
    title: 'Artists',
    icon: 'adwaita-artist',
    href: '/library/artists'
  },
  liked: {
    id: 'liked',
    title: 'Liked',
    icon: 'adwaita-like',
    href: '/library/liked',
    queueSource: 'liked'
  },
  playlists: {
    id: 'playlists',
    title: 'Playlists',
    icon: 'adwaita-playlist',
    href: '/library/playlists'
  },
  uploads: {
    id: 'uploads',
    title: 'Uploads',
    icon: 'custom-upload',
    href: '/library/uploads',
    queueSource: 'uploads',
    requiresUpload: true
  }
};

/** The heading of each view. */
export const KIND_TITLES = LIBRARY_KINDS.reduce(
  (titles, kind) => ({ ...titles, [kind]: LIBRARY_KIND_INFO[kind].title }),
  {} as Record<LibraryKind, string>
);

/**
 * Resolves the view a route segment names.
 *
 * @param value The route segment, as the URL carried it.
 * @returns The view, or `null` when the segment names none.
 */
export function libraryKind(value: string | undefined): LibraryKind | null {
  const kind = LIBRARY_KINDS.find((candidate) => candidate === value);
  return kind ?? null;
}
