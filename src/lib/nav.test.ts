/**
 * Tests for the sidebar's navigation: which sections and entries a session
 * sees.
 */
import { describe, expect, it } from 'vitest';

import { navSections, visibleNavSections } from './nav';
import type { NavContext, NavSection } from './nav';
import type { SystemInfo, UserView } from './stores/session.svelte';

/** A context for an ordinary signed-in account. */
const member: NavContext = { isAdmin: false, systemInfo: null };

/** A context for an administrator. */
const admin: NavContext = { isAdmin: true, systemInfo: null };

/** Sections that cover every rule the filter applies. */
const sections: NavSection[] = [
  {
    entries: [
      { href: '/search', label: 'Search' },
      { href: '/admin/users', label: 'Hidden', visible: (context) => context.isAdmin }
    ]
  },
  {
    title: 'Admin',
    adminOnly: true,
    entries: [{ href: '/admin/settings', label: 'Settings' }]
  },
  { title: 'Empty', entries: [] }
];

describe('navigation', () => {
  it('hides administrator sections and entries from a member', () => {
    const visible = visibleNavSections(sections, member);

    expect(visible).toHaveLength(1);
    expect(visible[0].entries.map((entry) => entry.href)).toEqual(['/search']);
  });

  it('shows administrators every section and entry', () => {
    const visible = visibleNavSections(sections, admin);

    expect(visible.map((section) => section.title)).toEqual([undefined, 'Admin']);
    expect(visible[0].entries.map((entry) => entry.href)).toEqual(['/search', '/admin/users']);
    expect(visible[1].entries.map((entry) => entry.href)).toEqual(['/admin/settings']);
  });

  it('drops a section nothing is left in', () => {
    const onlyAdmin: NavSection[] = [
      { title: 'Admin', adminOnly: true, entries: [{ href: '/admin/users', label: 'Users' }] }
    ];

    expect(visibleNavSections(onlyAdmin, member)).toEqual([]);
  });

  it('leaves the declared order alone', () => {
    const ordered: NavSection[] = [
      {
        entries: [
          { href: '/b', label: 'B' },
          { href: '/a', label: 'A' }
        ]
      }
    ];

    expect(visibleNavSections(ordered, member)[0].entries.map((entry) => entry.href)).toEqual([
      '/b',
      '/a'
    ]);
  });
});

/**
 * Builds what the server offers, with one Server-view setting.
 *
 * @param serverBrowse The `privacy.server_browse` value the server reports.
 * @param uploads Whether the server accepts uploads.
 * @returns The server's shape.
 */
function systemInfo(serverBrowse: string, uploads = false): SystemInfo {
  return {
    apiVersion: 1,
    features: {
      acquireOnPlaylistAdd: false,
      acquireOnSave: false,
      serverBrowse,
      uploads
    },
    layers: [],
    serverType: 'hearthsound',
    version: '0.1.5'
  };
}

/** Builds an account with the given upload permission. */
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

describe('library navigation', () => {
  it('shows the library and the server view while the server offers it', () => {
    const context: NavContext = { isAdmin: false, systemInfo: systemInfo('all') };

    expect(visibleNavSections(navSections, context).map((section) => section.title)).toEqual([
      undefined,
      'Library',
      'Server'
    ]);
  });

  it('hides the server view when the deployment closed it', () => {
    const context: NavContext = { isAdmin: false, systemInfo: systemInfo('disabled') };

    expect(visibleNavSections(navSections, context).map((section) => section.title)).toEqual([
      undefined,
      'Library'
    ]);
  });

  it('hides the server view until the session read what the server offers', () => {
    expect(visibleNavSections(navSections, member).map((section) => section.title)).toEqual([
      undefined,
      'Library'
    ]);
  });

  it('shows the uploads view only where uploading is allowed', () => {
    const hrefs = (context: NavContext): string[] =>
      visibleNavSections(navSections, context)
        .flatMap((section) => section.entries)
        .map((entry) => entry.href);
    const reference: NavContext = {
      isAdmin: false,
      systemInfo: systemInfo('all', true),
      user: account(true)
    };

    expect(hrefs(reference)).toContain('/library/uploads');
    expect(hrefs({ ...reference, user: account(false) })).not.toContain('/library/uploads');
    expect(
      hrefs({ ...reference, systemInfo: systemInfo('all', false), user: account(true) })
    ).not.toContain('/library/uploads');
  });
});
