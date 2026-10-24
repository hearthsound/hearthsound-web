# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- A cover the client already loaded is drawn at once when its page is opened
  again, instead of appearing only after its own queued image request, which
  spread a grid of cards across a handful of fetch rounds.

## [0.2.0] - 2026-10-23

### Added

- Connected Services, reached from the account menu, lists the listening
  services the server offers: the account each one is connected under, the
  layers it serves, the scrobbles still waiting for delivery and the last
  delivery failure. A service that links through its own site connects with one
  button; a service that links with a configuration shows its form and saves
  it; Disconnect asks first. A browser link's return says whether it worked.

- Home fills its three Discovery shelves from the listening services the reader
  linked: Recommended Albums and the albums of similar artists, with the
  Because You Listen to title naming the artist the server picked, and the
  playlists a service generated. Each shelf's full list asks for the same reads
  at its own length.

- An album's menu adds the whole album to a playlist in one request, through
  the same "Add to Playlist" submenu a song has. A new playlist is created
  first and filled with the album's tracks.

- A playlist's hero menu offers Reorder: its rows become a reorder list with a
  grip on each, and Done saves the new order in one request. Escape leaves
  reorder mode and keeps the order the server stored.

### Changed

- The end-to-end suite drives the listening-service surfaces: connecting a
  service from the account menu and disconnecting it, Home's three Discovery
  shelves, a playlist reorder, adding an album to a playlist in one step, and
  the Top Result card's relevance choice.

- A queued song now knows its album and artist whichever list it came from, so
  "Go to Album" and "Go to Artist" work for a liked-songs, uploads or playlist
  row and not only for a row of an album or an artist page. The queue endpoint
  names both ids on every row.

- The Top Result card on the search page is the entity the server scored as
  the closest match, instead of the first entity whose name the client thought
  matched the query. An artist, an album and a song that score the same keep
  that order, and server order decides inside one kind.

- The native API client follows the server's library and search changes:
  playlist reorder and whole-collection add routes, queue rows that name their
  album and artist, and a server-browse feature that is a plain yes or no.
  The retired server-browse setting is no longer named in the admin settings
  page.

- The native API client follows the server's plugin changes: the plugin view
  no longer carries `approved` and gains `upgrade`, the available-plugin
  listing carries `permissions`, and the client knows the archive `inspect`
  route.

- Installing a plugin no longer needs a separate approval step in the admin
  view or the setup wizard: the server grants the manifest's permissions and
  enables the plugin, and only an upgrade that widens them asks for review.

- The Review Upgrade dialog lists the permissions the staged version adds, and
  the review button follows the staged upgrade the server reports.

- The setup wizard lists the permissions an offered plugin requests, and its
  risk pill shows them before the plugin is installed.

- Each installed plugin's row menu offers Permissions, which opens what the
  plugin asks for with its risk labels.

- Installing a plugin from an index asks for confirmation with the permissions
  it will be granted, with a "Don't ask again" checkbox that turns off
  `plugins.confirm_install`. An upgrade of an installed plugin installs
  directly and opens the review when the server stages it.

- The File tab reads a chosen archive before installing it and lists its id,
  version and permissions, leaving Install File out of reach until the server
  has answered.

- A file install that widens an installed plugin's permissions reports that the
  upgrade waits for review and opens the review, instead of reporting an
  install that did not happen.

- Cover images load a few at a time, behind the placeholder that stands for
  them. A grid of a hundred cards used to ask for a hundred pictures at once,
  which held every connection the browser opens and left the page's own requests
  waiting; the gate keeps four in flight, leaves the rest to the page, and skips
  the queue entirely for a picture that already loaded. The placeholder now
  shows from the first frame instead of after a failure, and an image is
  requested when its box comes near the viewport.

- Row, queue and now-playing covers ask the server for a size that matches their
  box, so a 40-pixel row no longer downloads a 300-pixel picture.

- A detail page opens with what the card that led to it already showed. Every
  list and detail read records the artist, album or playlist it read, and the
  detail page draws its hero, its counts and its rows from that record before
  the server answers: an artist card's page shows the name and portrait and
  sizes its album placeholders from `albumCount`, an album's page sizes its rows
  from `songCount`, and a playlist opens complete because the list already read
  its entries. The biography and the top songs no longer hold the page up; each
  fills in when it arrives. The record is forgotten when the account signs out.

- A list's load placeholders stand for exactly what is about to arrive. The
  first page draws `min(total, page size)` cards or rows, read from the new
  library counts the server reports, and each later batch draws the items the
  next page will bring, so the last page of 585 albums shimmers 45 times rather
  than a whole page. The counts refresh after a library, playlist or upload
  change and are forgotten when the account signs out; a total the server has
  not reported yet falls back to one page.

### Fixed

- A row menu near the bottom of a list (the installed plugins, users, folders
  and other boxed lists) is no longer cut off at the list's edge, and opening
  the last row's menu no longer scrolls the page to make room. The menu is
  placed against the window and opens above its button when there is no room
  below.
- On a phone, the account menu in the navigation drawer no longer closes when
  Appearance is pressed; its System, Light and Dark choices open as they do in
  the sidebar.

## [0.1.0] - 2026-10-22

### Added

- The client scaffold: a SvelteKit static single-page application with the
  application shell frame, strict TypeScript, ESLint and Prettier checks, a
  Vitest setup and a continuous integration workflow.
- The native API client: the server's OpenAPI document with the types generated
  from it, a script that synchronizes and verifies both, and a typed client
  that carries the session's CSRF token and signs out a rejected session.
- The Subsonic client: the `/rest` transport with its wire types, its
  form-encoded writes and the failed envelope as a typed error, so playback and
  library views call the protocol directly.
- The live state the interface renders: the server event stream with its typed
  events, the track availability map, the toast stack and the fixed labels for
  availability, acquisition progress and queue prefetch state.
- The application shell: the boot sequence that sends a server without an
  administrator to the setup wizard and a browser without a session to the
  sign-in form, the sign-in form itself, the sidebar with the navigation, the
  account and the sign-out command, and the toast stack.
- Playback: the player over one audio element, the in-memory queue with its
  panel in the now-playing view, the media session the system controls drive,
  the scrobble reports, and the queue declaration the server's prefetch
  scheduler looks ahead from, with each queue item showing what the server is
  doing about it.
- Search: the search view over the library and the catalogues it draws from,
  the song rows and album and artist cards, and the acquisition flow that
  fetches a song the server does not hold yet and plays it as soon as it
  arrives.
- The personal library: the track, album, artist, liked and playlist lists of
  the personal scope with endless paging, the album and artist pages with
  their Save to library control.
- Feedback: the like, dislike and rating controls on song rows, on album and
  artist headers and in the player bar, with the liked view reading itself
  again whenever the library changes.
- Playlists: the new-playlist dialog, the playlist page with the rename,
  remove-track and delete commands, and the add-to-playlist menu on every
  song row.
- Uploads: the upload page with its file picker and drop zone, one request per
  file with its own progress, the processing and outcome every file reports,
  and the view that lists what was uploaded behind the server's upload setting
  and the account's permission.
- Configuration forms: the client's own renderer set over the JSON schemas that
  plugin manifests declare, with the controls, the layouts, the string lists and
  the validation an administrator's configuration form needs.
- The first administrator views: the account list with its create, edit and
  disable commands, their permissions and their daily quotas, and the music
  folders with their association, their names, their scans and the progress a
  running scan reports.
- The plugin, instance and layer views: the installed plugins, the indexes and
  repositories they are installed from and the archives installed from this
  computer on one page of headed groups, where installing is approval and a
  staged upgrade is the only review; the configured instances as one grey group
  with their health and their configuration form; and the order in which each
  layer tries its instances, saved as the order changes.
- The storage, acquisition and setting views: the usage of the library, the
  cache and the scanned folders as one stacked bar with its legend, the pinned
  tracks and the policy rows that decide what is kept and evicted, with the
  maintenance pass run on demand; the ledger of what the server is acquiring,
  split into Active and Recent rows with the state beside each track and its
  cancel and retry commands; and every server setting under its group with the
  readable name, a control that suits its value and a note where its value is
  pinned, with Use Default in the row menu.
- The first-run wizard: the step that creates the administrator from the
  one-time setup link, the music folders that are scanned from then on, the
  plugins offered for each layer with the permissions they ask for, the
  instance each of them is configured with, the order the layers try them in,
  and the checks that say what answers.
- Home: the landing page at `/` with its shelves from the recent, newest,
  frequent and highest album orders, the liked albums, artists and songs, and
  the random albums and songs, the Customize Home dialog that orders and hides
  the thirteen sections in this browser, every section's full list under
  `/home/<section-id>`, and the loading, empty and failed states.
- System states: the booting frame over the plain onboarding frame, the Page
  Not Found and Not Allowed status pages inside the shell with their document
  titles, the floating server-unreachable banner with its Retry action, and the
  session-expired banner above the sign-in title.
- The end-to-end suite: a real server started over generated audio and the
  fixture plugins, and the specs that walk the first-run wizard, search and
  remote playback, the queue, the library, uploads, the media session, the
  administrator views, Home and the system states.
- The administration overview at `/admin`: six area cards with their counts, a
  line for a running scan or the last one, provider health pills, the storage
  bar, and how many acquisitions are running and how many recent ones failed.
- Component tests for the menu, the dialog, the select, the reorder list and
  the lyrics panel, over their keyboard and focus behavior.
- A reload keeps what was playing: the queue, the current song and its position
  come back for the same account, always paused, and nothing plays, acquires or
  reports until the play button is pressed.

- Release packaging: `npm run package` zips the built client with its
  SHA-256, and a tag publishes both as a GitHub release whose notes are the
  version's section of this file.

### Changed

- Form fields drop their hint text and validate when the reader leaves them or
  a submit is refused, with the app's own message naming the broken rule
  instead of the browser's validation bubble.
- A new import root defaults to Copy, and its mode menu offers Move, Copy and
  Link.
- Available plugins leave out a plugin that is already installed at the same
  version.
- Recent acquisition failures read as sentences instead of the server's reason
  codes.
- Byte-valued settings and the daily byte quota are shown and edited in GiB,
  and the storage bar's legend counts the data it does not classify as Other
  instead of Free.
- A submenu that does not fit to the right of its item opens to the left
  instead.
- The code is reorganized around registries and facades: the route and
  library-kind registries, the per-area admin API facades, the shared paged
  list, and the split player, now-playing, library, plugins and shell modules.

### Fixed

- Typing in a search field no longer loses focus or keystrokes when the search
  runs: the address update no longer resets focus (SvelteKit 3's `reset`
  option replaces the removed `keepFocus`), a space typed between words is no
  longer eaten when the trimmed query comes back from the address, and opening
  the phone drawer with "/" puts the cursor in its search field again.
- The player's cover falls back to its placeholder when the artwork fails to
  load.
- A dialog opened from a menu takes focus instead of leaving it on the menu
  item.
- The add-to-playlist submenu no longer claims there are no playlists while it
  is still reading them.
- The Top Result name no longer runs under its play button.
- The setup summary no longer repeats "ready" after the server's answer.
- Sign-in and setup pages have a main landmark.
- The quota fields of the account dialog and the number fields of the settings
  editors read the numbers a number input reports, instead of only the text it
  holds before it is edited.
- The first-run wizard's order step keeps what the administrator left on it.
  The layers are seeded once per run, so an instance deleted there stays
  deleted when the administrator goes back to the configure step and forward
  again, instead of coming back.
