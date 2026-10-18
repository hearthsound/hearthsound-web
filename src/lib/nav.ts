/**
 * The navigation the sidebar renders.
 *
 * The list is data, not markup: a feature appends its entries here and every
 * entry may narrow itself with a predicate, so the sections a session sees are
 * derived from the account and from what the server offers. Administrators get
 * the sections marked as theirs and nothing else does.
 */
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
  /** Whether the section is shown to administrators only. */
  adminOnly?: boolean;
  /** The links of the section, in order. */
  entries: NavEntry[];
}

/**
 * Reports whether the server-wide view is offered.
 *
 * The server closes the view in `privacy.server_browse`; until the session has
 * read what the server offers the entries stay hidden, so a link nothing can
 * fill is never shown.
 *
 * @param context The signed-in account and the server's shape.
 * @returns `true` when the server view is shown.
 */
function serverViewVisible(context: NavContext): boolean {
  const browse = context.systemInfo?.features.serverBrowse;
  return browse === 'all' || browse === 'permanent_only';
}

/**
 * Reports whether uploading is offered.
 *
 * Uploading needs both the server's setting and the account's permission, so
 * neither the upload page nor the listing of what was uploaded is shown unless
 * both hold.
 *
 * @param context The signed-in account and the server's shape.
 * @returns `true` when uploading is shown.
 */
function uploadsVisible(context: NavContext): boolean {
  return context.systemInfo?.features.uploads === true && context.user?.permissions.upload === true;
}

/**
 * The sidebar's sections.
 *
 * Feature work appends its entries to the section they belong to.
 */
export const navSections: NavSection[] = [
  {
    entries: [
      { href: '/search', label: 'Search' },
      { href: '/queue', label: 'Queue' }
    ]
  },
  {
    title: 'Library',
    entries: [
      { href: '/library/songs', label: 'Songs' },
      { href: '/library/albums', label: 'Albums' },
      { href: '/library/artists', label: 'Artists' },
      { href: '/library/liked', label: 'Liked' },
      { href: '/library/playlists', label: 'Playlists' },
      { href: '/library/uploads', label: 'Uploads', visible: uploadsVisible }
    ]
  },
  {
    title: 'Server',
    entries: [
      { href: '/server/songs', label: 'Songs', visible: serverViewVisible },
      { href: '/server/albums', label: 'Albums', visible: serverViewVisible },
      { href: '/server/artists', label: 'Artists', visible: serverViewVisible }
    ]
  }
];

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
    if (section.adminOnly === true && !context.isAdmin) {
      continue;
    }
    const entries = section.entries.filter(
      (entry) => entry.visible === undefined || entry.visible(context)
    );
    if (entries.length > 0) {
      visible.push({ ...section, entries });
    }
  }
  return visible;
}
