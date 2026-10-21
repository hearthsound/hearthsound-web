/**
 * The Home page's sections.
 *
 * The list is the p07 order: the eight sections shown by default first, then
 * Most Played, Highest Rated, Random Albums, Liked Songs and Random Songs
 * (`layouts.md` 12.2). "Playing Now" is not among them: privacy-scope-2 removed
 * it from Home and from the Customize Home list, leaving 13 sections.
 *
 * Each section's id names its full-list page at `/home/<section-id>` (E8). The
 * four Discovery sections - Recommended Albums, Because You Listen to,
 * Generated Playlists and Mood Playlists - have no data source today, so they
 * render nothing until the Discovery layer supplies one; they keep their place
 * in the list and their row in the dialog.
 */

/** What one section shows. */
export type HomeSectionKind = 'album' | 'artist' | 'playlist' | 'song';

/** One section of the Home page. */
export interface HomeSection {
  /** The last segment of its full-list route, `/home/<id>`. */
  id: string;
  /** The shelf title and the dialog row title. */
  title: string;
  /** The shape of its items. */
  kind: HomeSectionKind;
  /** Whether the section is shown for a browser with nothing stored. */
  defaultOn: boolean;
  /** Whether it waits for the Discovery layer (M6) and shows the data note. */
  discovery: boolean;
}

/** The 13 sections in the p07 order. */
export const HOME_SECTIONS: readonly HomeSection[] = [
  {
    id: 'recently-played',
    title: 'Recently Played',
    kind: 'album',
    defaultOn: true,
    discovery: false
  },
  {
    id: 'recommended-albums',
    title: 'Recommended Albums',
    kind: 'album',
    defaultOn: true,
    discovery: true
  },
  {
    id: 'recently-added',
    title: 'Recently Added',
    kind: 'album',
    defaultOn: true,
    discovery: false
  },
  {
    id: 'because-you-listen',
    title: 'Because You Listen to an Artist',
    kind: 'album',
    defaultOn: true,
    discovery: true
  },
  {
    id: 'liked-albums',
    title: 'Liked Albums',
    kind: 'album',
    defaultOn: true,
    discovery: false
  },
  {
    id: 'generated-playlists',
    title: 'Generated Playlists',
    kind: 'playlist',
    defaultOn: true,
    discovery: true
  },
  {
    id: 'liked-artists',
    title: 'Liked Artists',
    kind: 'artist',
    defaultOn: true,
    discovery: false
  },
  {
    id: 'mood-playlists',
    title: 'Mood Playlists',
    kind: 'playlist',
    defaultOn: true,
    discovery: true
  },
  {
    id: 'most-played',
    title: 'Most Played',
    kind: 'album',
    defaultOn: false,
    discovery: false
  },
  {
    id: 'highest-rated',
    title: 'Highest Rated',
    kind: 'album',
    defaultOn: false,
    discovery: false
  },
  {
    id: 'random-albums',
    title: 'Random Albums',
    kind: 'album',
    defaultOn: false,
    discovery: false
  },
  {
    id: 'liked-songs',
    title: 'Liked Songs',
    kind: 'song',
    defaultOn: false,
    discovery: false
  },
  {
    id: 'random-songs',
    title: 'Random Songs',
    kind: 'song',
    defaultOn: false,
    discovery: false
  }
];

/** The section ids in the p07 order, which is also the default Home order. */
export const DEFAULT_HOME_ORDER: readonly string[] = HOME_SECTIONS.map((section) => section.id);

/** The note a Discovery row carries in the Customize Home dialog (p07b). */
export const HOME_DISCOVERY_NOTE = 'Shown when it has something to show';

/**
 * The sections by id, for a page that has only the id a URL or a stored layout
 * carries; an id this build no longer knows is simply absent.
 */
export const HOME_SECTION_BY_ID: Readonly<Record<string, HomeSection>> = Object.fromEntries(
  HOME_SECTIONS.map((section) => [section.id, section])
);
