# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.7] - 2026-10-26

### Fixed

- The biography dialog opens at the first line of the text: focus starts on the text instead of
  the Close command, which scrolled a long biography to its end on a phone.

## [0.2.6] - 2026-10-26

### Added

- An album card names the release's edition under the artist, and an album page
  shows it beside the year, so a standard release and its deluxe edition no
  longer look alike; two cards in one grid that a title, an artist and an
  edition still cannot tell apart say their year instead ("No year" when the
  release has none).

### Changed

- Use design 0.2.12.

### Fixed

- A drop-down opened inside a dialog shows its list under the control: the
  instance dialog's import-root mode was dead because the list is a fixed
  popover placed in viewport coordinates and the dialog's centring transform
  made the card its containing block, which pushed the list outside the card
  and cut it off. The list subtracts that offset, and the roots group keeps its
  rounded corners.

- The artist hero's Show more opens the whole biography in a 640 px dialog
  instead of expanding the clamped paragraph, which grew the header and moved
  the portrait and everything under it. The command is drawn only when the text
  really has more lines than the clamp.

- An artist page draws its shape while it reads: the hero, five song rows and
  the album cards shimmer, so a slow answer is no longer a blank page. The page
  no longer says "Nothing by this artist yet." while it is reading or while the
  enrichment job of the artist may still fill it in - the decision no longer
  waits for an origin the artist read does not report, and the wait is bounded
  by a 30 second window.

- An artist or album page reads its content again whenever the enrichment job
  announces the entity, even when the page already holds library albums or
  tracks: the job adds the catalog's discography and top songs beside the stored
  ones, so a stored artist's first visit gained its remote albums only after a
  reload.

## [0.2.5] - 2026-10-26

### Added

- The Albums list offers the Year order: the newest release first, with the
  choice kept in the address beside the others.

### Fixed

- A folder's scan result is shown in the server's own words: a refused prune
  reads "Nothing was removed: the folder root is empty, so the disk may not be
  mounted." instead of carrying a "Scan failed:" prefix, a real failure no
  longer says it twice, and a scan that finished with a warning ends the live
  line like a clean one.

- The reason behind the player's Failed chip hides four seconds after a tap on a
  phone, and a second tap starts the four seconds again, instead of the tooltip
  staying on screen.

## [0.2.4] - 2026-10-26

### Added

- An album acquisition's row in Admin > Acquisitions names the album and its
  artist instead of `Unknown track`, and words a failure as an album failure.

- The Account page gains a Save Location: an account that owns a scanned folder
  chooses between the server's managed library and that folder, and the music it
  saves is written there. A folder that cannot be written falls back to the
  managed library, and the server's notice about it is shown.

- An Account page, opened from the account menu, changes the account's own
  password and lists, creates and revokes its API keys and app passwords. A new
  credential's secret is shown once, and changing the password signs out every
  other device and stops every key and app password. Every password form -
  setup, the admin user dialog and this page - refuses a password shorter than
  eight characters with the server's own sentence.

- The player saves its queue on the server with `savePlayQueue`, so another
  device - or this one after its local storage is gone - carries on where the
  last one was. A queue read back from the server comes paused and loads nothing
  until it is played.

- The setup wizard checks the link it was opened with before it draws the
  administrator form: a link that is not the live one shows where to find the
  newest instead.

- A connected service's form opens on the configuration the server stores, with
  `[sealed]` where a secret lives; Save stays disabled until a field is edited,
  and an untouched placeholder keeps the stored secret.

- A song that waits for a download source says so - "Waiting for a download
  source", or "Waiting for the download source to answer" when the source is
  configured but silent - instead of failing or claiming to search, in the player
  and in Admin > Acquisitions.

- A cover the server answered `503` and a `Retry-After` for - an artwork source
  that asked to be left alone for a moment - is asked for once more after that
  wait, so a rate-limited provider shows the placeholder briefly instead of for
  the whole failure window.

- The player tells the server what it is doing with the track: it reports the
  start and the play, and reports the stop when playback pauses, stops, ends or
  the page is hidden, so the now-playing row clears at once instead of lingering
  for the track's length. A play the server refused is sent again on the next
  play and when the browser is online, and a play that never lands says so.

- A catalog artist or album page fills in as soon as the server's enrichment job
  has run: the discography, the biography, the top songs and the tracklist
  appear in place, without a reload and without a flash, and a cold page no
  longer claims the artist has nothing or the album has no songs.

- An artist card on the search page draws the online picture and how many
  albums the service knows the artist has, which tells two artists of the same
  name apart.

- A bulk like, save or unsave reports the ids the server did not apply, so a
  partly applied write says how many it took instead of failing silently.

- The song list can be narrowed to one of the genres the collection holds, and
  Play and Shuffle queue the same order and genre the list shows.

- The library's album, song and artist lists have a Sort menu. The order - and,
  for albums, an optional genre - lives in the address (`?sort=`, `?genre=`), so
  a reload, a shared link and Back all show the list the reader chose, and Play
  queues the songs in the order the list shows.

- An album's artist is a link to that artist's page, and a song row's artist
  name opens the artist too.

- A generated playlist carries a "Generated by <service>" pill and its refresh
  cadence, and its first edit asks "Edit This Playlist?" before it detaches and
  stops refreshing.

- Admin > Folders names what removing a folder would take - "3 likes and 2
  playlist entries on songs in this folder will be lost" - with a "Don't ask
  again" choice stored as `library.confirm_folder_removal`.

- Admin > Layers offers the instances that already serve a layer before the
  create form, so an instance made under Admin > Providers can be assigned
  without a duplicate.

- A folder whose last scan failed says so on its row and in the setup Summary,
  with its last successful scan below.

- Setup warns, once per required layer nothing serves, what a finished server
  then cannot do, and Continue stays available.

- A blank text setting shows the built-in default as its placeholder, so an
  empty field says what saving it means.

### Changed

- `@hearthsound/design` is 0.2.11: in the 340 px Install confirmation a long
  permission value wraps inside its own column instead of painting under the
  risk pill, and the package carries the link styles the new hero and track row
  links use.

- The player's volume, mute, shuffle and repeat choices belong to the account,
  and signing out removes every account's stored queue on that browser.

- A failed play keeps the Failed chip and its reason in a tooltip; on a touch
  screen a tap opens the reason for four seconds instead of opening the queue.

- An administrator who opens `/setup` after setup is complete goes Home with the
  toast "Setup is already complete.".

- Back in the setup wizard no longer returns to the administrator step once the
  administrator exists, the layer order is saved per layer so one refusal cannot
  hide another, and an instance configured on a later visit reaches its layer.

- A Menu and a Select are positioned against the window, so a drop-down in a
  settings group or a dialog is no longer clipped.

- An album or artist link is built only from the path the server spells, never
  from a display name, so two acts of one name open the right page.

### Fixed

- A press while a song is being acquired starts that song instead of resuming
  the previous one, and the bar shows the new song's own position and length.

- A failed or cooled-down acquisition reports its reason and offers a retry that
  ignores the cooldown; a request waiting for a download source says so instead
  of claiming to search for one.

- A refusal the server names (`hearthsoundReason`) is worded by its stored
  reason, so a spent daily allowance no longer reads as a missing permission.

- A second stream failure offers the retry disc instead of a pause that cannot
  work, and Stop or the end of the queue cancels an acquisition in flight.

- The play a listener hears is scrobbled, and a failed stream retried, with the
  id that streams rather than the catalog id it was requested as.

- Signing out leaves no other listener's membership marks, saved queue or player
  choices in the browser, and a search answer refreshes the marks it carries.

- A failed top-songs read says so with a retry instead of drawing an empty
  artist, and Play stays available for an artist the server knows.

- The Recently Added list stops asking for pages whose albums all fall outside
  its window.

- A playlist name over the server's limit is refused inside the dialog, with the
  rule named, instead of by a toast behind the scrim.

- An administration page, a settings row and Connected Services no longer stay
  busy when a request never reached the server, a failed setting save keeps the
  edit so it can be saved again, and Escape drops its error with it.

- A layer order the server refused puts the rows back to the order it holds, and
  an acquisition created while Admin > Acquisitions is open appears without a
  reload.

- A member who opens an administration address keeps the library sidebar.

## [0.2.3] - 2026-10-24

### Changed

- An artist and an album open on their readable path - `/artist/radiohead` and
  `/album/radiohead/in-rainbows` - instead of a page named by an id, so the
  address is the same whatever plugins the server runs. The page asks `hsResolve`
  which entity the path names and rewrites the address to the form the server
  spells when two names collide (`nirvana`, `nirvana--2`).

- The song library mark is drawn beside the title as a small muted check, instead
  of in a status column, so it stays visible on phones too. The album card badge
  is unchanged.

### Fixed

- A top song plays from an artist page outside the library: the page queues the
  rows it already holds, instead of asking for a collection the server only keeps
  for a stored artist.

## [0.2.2] - 2026-10-24

### Added

- An artist page shows the artist's whole discography and an album page the whole
  tracklist, whichever id opened the page: the catalog's albums and songs with
  the library's own in their places. A song or an album the library holds carries
  a check mark; one that is not in the library carries none.

### Changed

- Play, Shuffle and a press on a track queue the tracklist the album page holds,
  so an album outside the library plays in full from its page.

### Fixed

- The artist page's empty and not-found lines no longer say the artist is
  missing from the library when it is simply one the catalog has nothing for.

## [0.2.1] - 2026-10-24

### Fixed

- A cover the client already loaded is drawn at once when its page is opened
  again, instead of appearing only after its own queued image request, which
  spread a grid of cards across a handful of fetch rounds.

- A cover the server could not deliver keeps its placeholder and is remembered
  as failed for a while, so a page no longer asks for the same broken image
  again each time a card that shows it is drawn.

- Home draws each shelf as soon as its own answer arrives, with placeholder
  shelves for the sections still loading, so a Discovery read that waits on a
  listening service no longer holds up Recently Played, Recently Added and the
  Liked shelves.

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
