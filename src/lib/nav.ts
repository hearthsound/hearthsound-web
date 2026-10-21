/**
 * The navigation the sidebar renders.
 *
 * The list is data, not markup: the shell walks the sections and draws one row
 * per entry, so every view states where it sits rather than repeating the
 * sidebar. Entries narrow themselves with a predicate, which keeps a link the
 * session cannot fill - Uploads without the permission, Administration for a
 * member - out of the sidebar entirely.
 *
 * The library sidebar is the one l02 describes: Home and Queue above the
 * Library heading, the Administration row at the foot, and no Server section
 * (server-scope browsing is closed, privacy-scope). The administration area
 * has its own list: a Library row that leads back, then the areas under the
 * Administration heading.
 */
import type { IconName } from '@hearthsound/design/icons';

import type { SystemInfo, UserView } from '#lib/stores/session.svelte';

/** What an entry may test before it is shown. */
export interface NavContext {
  /** Whether the signed-in account administers the server. */
  isAdmin: boolean;
  /** What the server offers, once the session read it. */
  systemInfo: SystemInfo | null;
  /** The signed-in account, once the session read it. */
  user?: UserView | null;
}

/** One link of the sidebar. */
export interface NavEntry {
  /** The route the link opens. */
  href: string;
  /** The text of the link. */
  label: string;
  /** The 16 px icon the row leads with. */
  icon: IconName;
  /**
   * Reports whether this entry is shown.
   *
   * @param context The signed-in account and the server's shape.
   * @returns `true` when the entry is shown.
   */
  visible?(context: NavContext): boolean;
}

/** A titled group of links; a section without a title has no heading. */
export interface NavSection {
  /** The heading above the section, when it has one. */
  title?: string;
  /** The links of the section, in order. */
  entries: NavEntry[];
}

/**
 * Reports whether uploading is offered.
 *
 * Uploading needs both the server's setting and the account's permission, so
 * neither the upload page nor the listing of what was uploaded is shown unless
 * both hold (E9, o06).
 *
 * @param context The signed-in account and the server's shape.
 * @returns `true` when uploading is shown.
 */
export function canUpload(context: NavContext): boolean {
  return context.systemInfo?.features.uploads === true && context.user?.permissions.upload === true;
}

/** The library sidebar, in its l02 order. */
export const librarySections: readonly NavSection[] = [
  {
    entries: [
      { href: '/', label: 'Home', icon: 'adwaita-home' },
      { href: '/queue', label: 'Queue', icon: 'adwaita-queue' }
    ]
  },
  {
    title: 'Library',
    entries: [
      { href: '/library/songs', label: 'Songs', icon: 'adwaita-song' },
      { href: '/library/albums', label: 'Albums', icon: 'adwaita-album' },
      { href: '/library/artists', label: 'Artists', icon: 'adwaita-artist' },
      { href: '/library/liked', label: 'Liked', icon: 'adwaita-like' },
      { href: '/library/playlists', label: 'Playlists', icon: 'adwaita-playlist' },
      {
        href: '/library/uploads',
        label: 'Uploads',
        icon: 'custom-upload',
        visible: canUpload
      }
    ]
  }
];

/**
 * The row that enters the administration area.
 *
 * It sits at the foot of the library sidebar, directly above the account row,
 * and only an administrator sees it (l02).
 */
export const administrationEntry: NavEntry = {
  href: '/admin',
  label: 'Administration',
  icon: 'adwaita-settings',
  visible: (context) => context.isAdmin
};

/** The administration area's list, under its own heading (l02). */
export const adminSections: readonly NavSection[] = [
  {
    title: 'Administration',
    entries: [
      { href: '/admin', label: 'Overview', icon: 'adwaita-home' },
      { href: '/admin/users', label: 'Users', icon: 'adwaita-users' },
      { href: '/admin/folders', label: 'Folders', icon: 'adwaita-folder' },
      { href: '/admin/plugins', label: 'Plugins', icon: 'adwaita-plugin' },
      { href: '/admin/providers', label: 'Providers', icon: 'adwaita-remote' },
      { href: '/admin/layers', label: 'Layers', icon: 'adwaita-layers' },
      { href: '/admin/storage', label: 'Storage', icon: 'adwaita-storage' },
      { href: '/admin/acquisitions', label: 'Acquisitions', icon: 'adwaita-acquire' },
      { href: '/admin/settings', label: 'Settings', icon: 'adwaita-settings' }
    ]
  }
];

/** The row that leaves the administration area (b02). */
export const libraryBackEntry: NavEntry = {
  href: '/',
  label: 'Library',
  icon: 'adwaita-back'
};

/**
 * Returns the sections and entries a session sees.
 *
 * @param sections The sections to filter.
 * @param context The signed-in account and the server's shape.
 * @returns The visible sections, in the order they were declared.
 */
export function visibleNavSections(
  sections: readonly NavSection[],
  context: NavContext
): NavSection[] {
  const visible: NavSection[] = [];
  for (const section of sections) {
    const entries = section.entries.filter(
      (entry) => entry.visible === undefined || entry.visible(context)
    );
    if (entries.length > 0) {
      visible.push({ ...section, entries });
    }
  }
  return visible;
}
