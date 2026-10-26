/**
 * What the shell knows about a route before it draws it.
 *
 * The shell draws the phone bar for most pages, but a page that draws its own
 * k25 header takes the "Open Navigation" button with it; without the registry
 * that decision was a hand-maintained list inside the layout, and every new
 * page had to remember to edit it. The table below derives its entries from the
 * registries the pages already have - the library kinds, the home sections and
 * the administration rows - so adding one of those never means editing the
 * shell.
 */

import { LIBRARY_KIND_INFO, LIBRARY_KINDS } from '#lib/library/kinds';
import { HOME_SECTIONS } from '#lib/home/sections';
import { adminSections } from '#lib/nav';

/** What a page decides about the shell around it. */
export interface RouteMetadata {
  /**
   * Whether the page draws its own k25 header, and with it the drawer command
   * that leads the phone bar. A page that does leaves the shell's phone bar
   * out; every other page gets it.
   */
  ownsHeader: boolean;
}

/** A route that draws its own header. */
const OWN_HEADER: RouteMetadata = { ownsHeader: true };

/** What the shell assumes about a path no rule names. */
const SHELL_HEADER: RouteMetadata = { ownsHeader: false };

/** One shape of route and the shell facts it carries. */
interface RouteRule {
  /**
   * The path, or the start of a path when it ends in `*`.
   *
   * A trailing `*` covers every route below the path it follows, which is how
   * the detail pages (`/album/<id>`) are named without listing ids.
   */
  readonly pattern: string;
  readonly metadata: RouteMetadata;
}

/**
 * Builds the shell's route table.
 *
 * @returns One rule per route shape, most specific first.
 */
function routeTable(): RouteRule[] {
  const routes: RouteRule[] = [{ pattern: '/', metadata: OWN_HEADER }];

  for (const kind of LIBRARY_KINDS) {
    routes.push({ pattern: LIBRARY_KIND_INFO[kind].href, metadata: OWN_HEADER });
  }
  // The opinion lists live beside their library views but are their own pages.
  routes.push(
    { pattern: '/liked/albums', metadata: OWN_HEADER },
    { pattern: '/liked/artists', metadata: OWN_HEADER }
  );

  for (const section of HOME_SECTIONS) {
    routes.push({ pattern: `/home/${section.id}`, metadata: OWN_HEADER });
  }

  for (const section of adminSections) {
    for (const entry of section.entries) {
      // The overview keeps the shell's phone bar: its board has no k25 header
      // of its own (l10 B). Every other administration area draws one.
      if (entry.href !== '/admin') {
        routes.push({ pattern: entry.href, metadata: OWN_HEADER });
      }
    }
  }

  routes.push(
    { pattern: '/search', metadata: OWN_HEADER },
    { pattern: '/search/*', metadata: OWN_HEADER },
    { pattern: '/account', metadata: OWN_HEADER },
    { pattern: '/account/services', metadata: OWN_HEADER },
    { pattern: '/album/*', metadata: OWN_HEADER },
    { pattern: '/artist/*', metadata: OWN_HEADER },
    { pattern: '/playlist/*', metadata: OWN_HEADER }
  );

  return routes;
}

/** The shell's route table, built once. */
const ROUTES = routeTable();

/**
 * Reports whether a rule covers a path.
 *
 * @param rule The rule to test.
 * @param pathname The path the browser shows.
 * @returns `true` when the rule names the path.
 */
function covers(rule: RouteRule, pathname: string): boolean {
  if (!rule.pattern.endsWith('*')) {
    return pathname === rule.pattern;
  }
  return pathname.startsWith(rule.pattern.slice(0, -1));
}

/**
 * Looks up what the shell needs to know about a path.
 *
 * @param pathname The path the browser shows, without its query string.
 * @returns The facts the shell draws the frame from; a path no rule names is a
 *   page that relies on the shell's phone bar.
 */
export function routeMetadata(pathname: string): RouteMetadata {
  for (const rule of ROUTES) {
    if (covers(rule, pathname)) {
      return rule.metadata;
    }
  }
  return SHELL_HEADER;
}
