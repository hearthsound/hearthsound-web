/**
 * The readable names of the server settings.
 *
 * Every settings row and every storage policy row is titled with the name the
 * copy specification gives its key (c01, copy.md section 10.9a) and shows the
 * server's own description below it; the key itself is never displayed
 * (p26-key). A key that is not in the table yet falls back to its leaf segment
 * so a newer server still shows a row rather than nothing.
 */

/** The readable name of every key the specification names. */
const SETTING_NAMES: Readonly<Record<string, string>> = {
  'library.naming_template': 'File naming template',
  'library.cover_filename': 'Cover file name',
  'library.tags.embed_cover': 'Embed cover art in tags',
  'library.acquire_on_save': 'Get songs when saved to a library',
  'library.acquire_on_playlist_add': 'Get songs when added to a playlist',
  'library.scan.artist_separators': 'Artist separators',
  'library.scan.concurrency': 'Files probed at once',
  'library.watch.debounce_ms': 'Wait after a folder change',
  'storage.cache.max_bytes': 'Cache size limit',
  'storage.cache.min_free_bytes': 'Minimum free space',
  'storage.cache.eviction': 'Eviction order',
  'storage.cache.max_age_days': 'Maximum age of cached files',
  'storage.unpin_action': 'When the last pin is removed',
  'storage.autopin.play_count': 'Pin after this many plays',
  'acquisition.quality_profile': 'Quality profile',
  'acquisition.min_match_score': 'Minimum match score',
  'acquisition.interactive_eta_target_secs': 'Longest wait for a song you play',
  'acquisition.stall_timeout_secs': 'Stalled download timeout',
  'acquisition.queue_timeout_secs.interactive': 'Queue timeout for songs you play',
  'acquisition.queue_timeout_secs.background': 'Queue timeout for background downloads',
  'acquisition.poll_interval_ms.interactive': 'Download check interval, playing',
  'acquisition.poll_interval_ms.background': 'Download check interval, background',
  'acquisition.search_poll_interval_ms': 'Search check interval',
  'acquisition.completion_check_interval_ms': 'File completion check interval',
  'acquisition.max_candidates': 'Candidates per instance',
  'acquisition.max_concurrent': 'Downloads at once',
  'acquisition.unavailable_cooldown_hours': 'Retry unavailable songs after',
  'acquisition.verify.fingerprint': 'Verify downloads by fingerprint',
  'prefetch.enabled': 'Prefetch upcoming songs',
  'prefetch.lookahead': 'Songs to prefetch',
  'stream.max_concurrent_transcodes': 'Transcodes at once',
  'stream.pending.mode': 'Playing a song that is still downloading',
  'stream.pending.max_wait_secs': 'Longest wait for a downloading song',
  'search.catalog.enabled': 'Search the catalog',
  'search.catalog.timeout_ms': 'Catalog search time limit',
  'search.catalog.max_results': 'Catalog results per search',
  'subsonic.allow_account_password': 'Accept account passwords from apps',
  'subsonic.token_auth': 'Accept legacy token sign-in',
  'subsonic.default_scope': 'Default browse scope for apps',
  'artwork.timeout_ms': 'Artwork lookup time limit',
  'metadata.artist_info.timeout_ms': 'Artist info lookup time limit',
  'subsonic.rating_one_is_dislike': 'One-star rating means dislike',
  'subsonic.catalog_title_suffix': 'Catalog title suffix',
  'privacy.server_browse': 'Server browse content',
  'privacy.now_playing_visible': 'Show what people are playing',
  'plugins.update_check_hours': 'Check for plugin updates every',
  'plugins.auto_update': 'Update plugins automatically',
  'plugins.allow_sideload': 'Allow installing plugin files',
  'plugins.allow_third_party_repositories': 'Allow third-party repositories',
  'plugins.max_memory_mb': 'Plugin memory ceiling',
  'uploads.enabled': 'Uploads',
  'uploads.max_file_bytes': 'Largest upload',
  'users.default_permissions': 'New user permissions',
  'auth.session_ttl_days': 'Web session length',
  'auth.login_rate_limit_per_minute': 'Failed sign-ins allowed per minute'
};

/**
 * Returns the readable name of one setting key.
 *
 * @param key The dotted setting key.
 * @returns The name the copy specification gives the key, or the key's leaf
 *   segment with underscores as spaces and its first letter capitalised for a
 *   key the specification does not name yet.
 */
export function settingName(key: string): string {
  const name = SETTING_NAMES[key];
  if (name !== undefined) {
    return name;
  }
  const leaf = key.slice(key.lastIndexOf('.') + 1).replaceAll('_', ' ');
  return leaf.charAt(0).toUpperCase() + leaf.slice(1);
}

/**
 * Returns the title of a settings group.
 *
 * @param segment The first segment of the keys a group holds, e.g. `storage`.
 * @returns The segment with its first letter capitalised, e.g. `Storage`
 *   (p26c).
 */
export function groupTitle(segment: string): string {
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

/** The readable labels of the values a setting accepts. */
const CHOICE_LABELS: Readonly<Record<string, string>> = {
  lru: 'Least recently used',
  lfu: 'Least frequently used',
  fifo: 'First in, first out',
  demote: 'Demote to cache',
  delete: 'Delete the file',
  'lossless-preferred': 'Lossless preferred',
  compact: 'Compact',
  hold: 'Hold the request',
  fail: 'Fail the request',
  library: 'Library',
  server: 'Server',
  all: 'All files',
  permanent_only: 'Permanent files only',
  disabled: 'Disabled',
  acquire: 'Acquire',
  upload: 'Upload',
  download: 'Download'
};

/**
 * Returns the readable label of one value of a setting.
 *
 * The server sends the values it accepts (`allowed`); the tokens behind them
 * are terse, so the rows say what each choice means. A token without a label
 * is shown as it is, so a value the server adds still appears in the list.
 *
 * @param value The token the setting stores.
 * @returns Its readable label.
 */
export function settingChoiceLabel(value: string): string {
  return CHOICE_LABELS[value] ?? value;
}
