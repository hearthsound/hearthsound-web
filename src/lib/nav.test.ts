/**
 * Tests for the sidebar's navigation: which sections and entries a session
 * sees.
 */
import { describe, expect, it } from 'vitest';

import { visibleNavSections } from './nav';
import type { NavContext, NavSection } from './nav';

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
