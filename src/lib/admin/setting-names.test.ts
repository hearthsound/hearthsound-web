/**
 * Tests for the readable setting names and group titles.
 */
import { describe, expect, it } from 'vitest';

import { groupTitle, settingName } from './setting-names';

describe('setting names', () => {
  it('names the keys the copy specification lists', () => {
    expect(settingName('storage.cache.max_bytes')).toBe('Cache size limit');
    expect(settingName('prefetch.lookahead')).toBe('Songs to prefetch');
    expect(settingName('auth.login_rate_limit_per_minute')).toBe(
      'Failed sign-ins allowed per minute'
    );
  });

  it('humanises a key the specification does not name yet', () => {
    expect(settingName('server.future_limit')).toBe('Future limit');
    expect(settingName('future_key')).toBe('Future key');
  });

  it('keeps the name of a key with dots in its leaf segment', () => {
    expect(settingName('acquisition.poll_interval_ms.interactive')).toBe(
      'Download check interval, playing'
    );
  });
});

describe('group titles', () => {
  it('capitalises the first segment of the keys', () => {
    expect(groupTitle('storage')).toBe('Storage');
    expect(groupTitle('uploads')).toBe('Uploads');
  });
});
