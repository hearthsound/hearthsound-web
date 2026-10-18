/**
 * The navigation the sidebar renders.
 *
 * The list is data, not markup: a feature appends its entries here and every
 * entry may narrow itself with a predicate, so the sections a session sees are
 * derived from the account and from what the server offers. Administrators get
 * the sections marked as theirs and nothing else does.
 */
import type { SystemInfo } from '#lib/stores/session.svelte';

/** What an entry may test before it is shown. */
export interface NavContext {
  /** Whether the signed-in account administers the server. */
  isAdmin: boolean;
  /** What the server offers, once the session read it. */
  systemInfo: SystemInfo | null;
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
 * The sidebar's sections.
 *
 * Feature work appends its entries to the section they belong to.
 */
export const navSections: NavSection[] = [];

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
