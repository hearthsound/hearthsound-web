# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- The quota fields of the account dialog and the number fields of the settings
  editors read the numbers a number input reports, instead of only the text it
  holds before it is edited.
- The first-run wizard's order step keeps what the administrator left on it.
  The layers are seeded once per run, so an instance deleted there stays
  deleted when the administrator goes back to the configure step and forward
  again, instead of coming back.

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
  page, the media session the system controls drive, the scrobble reports, and
  the queue declaration the server's prefetch scheduler looks ahead from, with
  each queue item showing what the server is doing about it.
- Search: the search view over the library and the catalogues it draws from,
  the song rows and album and artist cards with their availability badges, and
  the acquisition flow that fetches a song the server does not hold yet and
  plays it as soon as it arrives.
- The personal library and the server view: the track, album, artist, liked and
  playlist lists of each scope with "Load more" paging, the album and artist
  pages with their Save to library control, and the server view hiding itself
  when the deployment has closed it.
- Feedback: the like, dislike and rating controls on song rows, on album and
  artist headers and in the player bar, with the liked view reading itself
  again whenever the library changes.
- Playlists: the new-playlist dialog with its temporary checkbox, the playlist
  page with the lifetime, rename, remove-track and delete commands, the
  add-to-playlist menu on every song row, and the badge a temporary playlist
  shows with the instant it expires at.
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
- The storage, acquisition and setting views: what the cache, the library and
  the scanned folders hold, the policy that decides what is kept and evicted,
  the maintenance pass run on demand, the ledger of what the server is
  acquiring with its progress, its cancel and retry commands, and every server
  setting with an editor that suits its value and a note where its value is
  pinned.
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
- The end-to-end suite: a real server started over generated audio and the
  fixture plugins, and the specs that walk the first-run wizard, search and
  remote playback, the queue, the library, uploads, the media session, the
  administrator views and Home.
