/**
 * The player choices the browser keeps.
 *
 * Volume, mute, shuffle and repeat survive a reload (k35, PLY-06,
 * repeat-persist). The choices belong to the signed-in account, so the key
 * carries its id and one browser can hold several listeners' choices at once
 * (E-G-2). Reading is total: a value that is missing, unreadable or out of
 * range falls back on its own, so a stored choice written by an older client
 * cannot reset the rest. Writing is best effort: a storage that refuses the
 * write keeps the choice for the session.
 */

/** The browser-wide key the releases before E-G-2 kept one listener's choices under. */
const LEGACY_PLAYER_SETTINGS_KEY = 'hearthsound.player';

/** The prefix every account's player choices key starts with (E-G-2). */
export const PLAYER_SETTINGS_PREFIX = 'hearthsound.player.';

/**
 * Returns the key one account's player choices are kept under.
 *
 * @param userId The account's client id.
 * @returns The storage key.
 */
export function playerSettingsKey(userId: string): string {
  return `${PLAYER_SETTINGS_PREFIX}${userId}`;
}

/** How the queue repeats (fc3-diff, repeat3). */
export type RepeatMode = 'off' | 'all' | 'song';

/** The repeat mode each press of the repeat button moves to. */
export const REPEAT_CYCLE: Record<RepeatMode, RepeatMode> = {
  off: 'all',
  all: 'song',
  song: 'off'
};

/** The player choices the browser keeps. */
export interface PlayerSettings {
  /** The output volume, from 0 to 1. */
  volume: number;
  /** Whether the output is muted. */
  muted: boolean;
  /** Whether the upcoming tracks play shuffled. */
  shuffle: boolean;
  /** How the queue repeats. */
  repeat: RepeatMode;
}

/** The settings an absent or unreadable stored value falls back to. */
const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  volume: 1,
  muted: false,
  shuffle: false,
  repeat: 'off'
};

/** The part of a storage the player reads, writes and clears its choices with. */
export type SettingsStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/**
 * Returns the browser's settings storage.
 *
 * @returns The local storage, or `null` when it is absent or blocked.
 */
export function settingsStorage(): SettingsStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Reads the stored player choices.
 *
 * Each value that is missing, unreadable or out of range falls back on its
 * own: full volume, unmuted, shuffle off, repeat off (k35, PLY-06,
 * repeat-persist).
 *
 * @param raw The stored JSON text, or `null` when nothing is stored.
 * @returns The settings to apply.
 */
export function parsePlayerSettings(raw: string | null): PlayerSettings {
  if (raw === null) {
    return { ...DEFAULT_PLAYER_SETTINGS };
  }
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      return { ...DEFAULT_PLAYER_SETTINGS };
    }
    const volume =
      'volume' in value &&
      typeof value.volume === 'number' &&
      Number.isFinite(value.volume) &&
      value.volume >= 0 &&
      value.volume <= 1
        ? value.volume
        : DEFAULT_PLAYER_SETTINGS.volume;
    const muted =
      'muted' in value && typeof value.muted === 'boolean'
        ? value.muted
        : DEFAULT_PLAYER_SETTINGS.muted;
    const shuffle =
      'shuffle' in value && typeof value.shuffle === 'boolean'
        ? value.shuffle
        : DEFAULT_PLAYER_SETTINGS.shuffle;
    const repeat =
      'repeat' in value && typeof value.repeat === 'string' && value.repeat in REPEAT_CYCLE
        ? (value.repeat as RepeatMode)
        : DEFAULT_PLAYER_SETTINGS.repeat;
    return { volume, muted, shuffle, repeat };
  } catch {
    return { ...DEFAULT_PLAYER_SETTINGS };
  }
}

/**
 * Reads the choices stored for an account, treating a blocked storage as absent.
 *
 * @param storage The storage to read, when there is one.
 * @param userId The account's client id.
 * @returns The stored text, or `null` when nothing readable is stored.
 */
export function readStoredSettings(storage: SettingsStorage | null, userId: string): string | null {
  try {
    return storage?.getItem(playerSettingsKey(userId)) ?? null;
  } catch {
    return null;
  }
}

/**
 * Stores the choices of one account.
 *
 * @param storage The storage to write, when there is one.
 * @param userId The account's client id.
 * @param settings The choices to keep.
 * @returns Nothing.
 */
export function writeStoredSettings(
  storage: SettingsStorage | null,
  userId: string,
  settings: PlayerSettings
): void {
  try {
    storage?.setItem(playerSettingsKey(userId), JSON.stringify(settings));
  } catch {
    // A storage that refuses the write keeps the choice for this session.
  }
}

/**
 * Removes the browser-wide player key of the releases before E-G-2.
 *
 * The browser-wide key holds one listener's choices and names no account, so
 * it is removed rather than adopted; nobody's preferences are applied to an
 * account.
 *
 * @param storage The storage to clean, when there is one.
 * @returns Nothing.
 */
export function dropLegacySettings(storage: SettingsStorage | null): void {
  try {
    storage?.removeItem(LEGACY_PLAYER_SETTINGS_KEY);
  } catch {
    // A storage that refuses the removal leaves one unreadable key behind.
  }
}
