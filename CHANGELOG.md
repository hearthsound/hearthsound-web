# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
