/**
 * Tests for the sidebar's navigation: the l02 order, which entries a session
 * sees, and which row is the current page.
 */
import { describe, expect, it } from 'vitest';

import { adminSections, administrationEntry, librarySections, visibleNavSections } from './nav';
import type { NavContext, NavSection } from './nav';
import type { SystemInfo, UserView } from './stores/session.svelte';

/** A context for an ordinary signed-in account. */
const member: NavContext = { isAdmin: false, systemInfo: null };

/** A context for an administrator. */
const admin: NavContext = { isAdmin: true, systemInfo: null };

/** The hrefs one section list renders, flattened. */
function hrefs(sections: readonly NavSection[]): string[] {
  return sections.flatMap((section) => section.entries.map((entry) => entry.href));
}

/** Sections that cover every rule the filter applies. */
const sections: NavSection[] = [
  {
    entries: [
      { href: '/visible', label: 'Visible', icon: 'adwaita-home' },
      {
        href: '/hidden',
        label: 'Hidden',
        icon: 'adwaita-lock',
        visible: (context) => context.isAdmin
      }
    ]
  },
  { title: 'Empty', entries: [] }
];

describe('navigation filtering', () => {
  it('hides entries a member may not see', () => {
    expect(hrefs(visibleNavSections(sections, member))).toEqual(['/visible']);
  });

  it('shows an administrator the entries their account allows', () => {
    expect(hrefs(visibleNavSections(sections, admin))).toEqual(['/visible', '/hidden']);
    expect(visibleNavSections(sections, admin).map((section) => section.title)).toEqual([
      undefined
    ]);
  });

  it('drops a section nothing is left in', () => {
    expect(visibleNavSections([{ title: 'Empty', entries: [] }], member)).toEqual([]);
  });

  it('leaves the declared order alone', () => {
    const ordered: NavSection[] = [
      {
        entries: [
          { href: '/b', label: 'B', icon: 'adwaita-home' },
          { href: '/a', label: 'A', icon: 'adwaita-home' }
        ]
      }
    ];

    expect(hrefs(visibleNavSections(ordered, member))).toEqual(['/b', '/a']);
  });
});

describe('library navigation', () => {
  it('lists Home and Queue above the Library heading', () => {
    expect(librarySections.map((section) => section.title)).toEqual([undefined, 'Library']);
    expect(hrefs(librarySections)).toEqual([
      '/',
      '/queue',
      '/library/songs',
      '/library/albums',
      '/library/artists',
      '/library/liked',
      '/library/playlists',
      '/library/uploads'
    ]);
  });

  it('labels each row with the icon l02 names', () => {
    expect(
      librarySections
        .flatMap((section) => section.entries)
        .map((entry) => [entry.label, entry.icon])
    ).toEqual([
      ['Home', 'adwaita-home'],
      ['Queue', 'adwaita-queue'],
      ['Songs', 'adwaita-song'],
      ['Albums', 'adwaita-album'],
      ['Artists', 'adwaita-artist'],
      ['Liked', 'adwaita-like'],
      ['Playlists', 'adwaita-playlist'],
      ['Uploads', 'custom-upload']
    ]);
  });

  it('has no Search row and no Server section', () => {
    const all = visibleNavSections(librarySections, admin);

    expect(hrefs(all)).not.toContain('/search');
    expect(hrefs(all).some((href) => href.startsWith('/server'))).toBe(false);
    expect(all.map((section) => section.title)).not.toContain('Server');
  });

  it('shows the Administration row to administrators only', () => {
    expect(administrationEntry.visible?.(admin)).toBe(true);
    expect(administrationEntry.visible?.(member)).toBe(false);
  });

  it('shows the uploads view only where uploading is allowed', () => {
    const context: NavContext = {
      isAdmin: false,
      systemInfo: systemInfo(true),
      user: account(true)
    };

    expect(hrefs(visibleNavSections(librarySections, context))).toContain('/library/uploads');
    expect(
      hrefs(visibleNavSections(librarySections, { ...context, user: account(false) }))
    ).not.toContain('/library/uploads');
    expect(
      hrefs(
        visibleNavSections(librarySections, {
          ...context,
          systemInfo: systemInfo(false),
          user: account(true)
        })
      )
    ).not.toContain('/library/uploads');
  });

  it('keeps uploads out until the session read what the server offers', () => {
    expect(hrefs(visibleNavSections(librarySections, member))).not.toContain('/library/uploads');
  });
});

describe('administration navigation', () => {
  it('lists the areas under one Administration heading', () => {
    expect(adminSections.map((section) => section.title)).toEqual(['Administration']);
    expect(hrefs(adminSections)).toEqual([
      '/admin',
      '/admin/users',
      '/admin/folders',
      '/admin/plugins',
      '/admin/providers',
      '/admin/layers',
      '/admin/storage',
      '/admin/acquisitions',
      '/admin/settings'
    ]);
  });
});

/**
 * Builds what the server offers.
 *
 * @param uploads Whether the server accepts uploads.
 * @returns The server's shape.
 */
function systemInfo(uploads: boolean): SystemInfo {
  return {
    apiVersion: 1,
    features: {
      acquireOnPlaylistAdd: false,
      acquireOnSave: false,
      serverBrowse: false,
      uploads
    },
    layers: [],
    serverType: 'hearthsound',
    version: '0.1.5'
  };
}

/**
 * Builds an account with the given upload permission.
 *
 * @param upload Whether the account may upload.
 * @returns The account.
 */
function account(upload: boolean): UserView {
  return {
    createdAt: 0,
    displayName: 'Listener',
    id: 'us_1',
    isAdmin: false,
    permissions: { acquire: true, download: true, upload },
    updatedAt: 0,
    username: 'listener'
  };
}
