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
