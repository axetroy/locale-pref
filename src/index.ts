import { cookieAdapter } from './adapters/cookie.js';
import { detectNavigatorLocale, isRegion as isRegionTag, normalizeLocale } from './utils.js';
import type { LocalePref, LocalePrefOptions, StorageAdapter } from './types.js';

const DEFAULT_STORAGE_KEY = 'user_locale';
const DEFAULT_LOCALE = 'en';
const FALLBACK_LOCALE = 'en';
const NAVIGATOR_SOURCE = 'navigator';

function assertOptions(options: LocalePrefOptions): void {
  const { storage, fallback, storageKey, defaultLocale, normalize, storageSetOptions, onError } = options;

  if (storage !== undefined && (typeof storage !== 'object' || storage === null)) {
    throw new TypeError('`storage` must be an object implementing the StorageAdapter interface');
  }
  if (fallback !== undefined && !Array.isArray(fallback)) {
    throw new TypeError('`fallback` must be an array');
  }
  if (storageKey !== undefined && typeof storageKey !== 'string') {
    throw new TypeError('`storageKey` must be a string');
  }
  if (defaultLocale !== undefined && typeof defaultLocale !== 'string') {
    throw new TypeError('`defaultLocale` must be a string');
  }
  if (normalize !== undefined && typeof normalize !== 'boolean') {
    throw new TypeError('`normalize` must be a boolean');
  }
  if (storageSetOptions !== undefined && (typeof storageSetOptions !== 'object' || storageSetOptions === null)) {
    throw new TypeError('`storageSetOptions` must be an object');
  }
  if (onError !== undefined && typeof onError !== 'function') {
    throw new TypeError('`onError` must be a function');
  }
}

/**
 * Create a locale preference instance.
 *
 * Reads the current locale from the storage backend, falling back through
 * `fallback` and finally `defaultLocale`; writes the chosen locale back to the
 * same backend. Every option has a default, so `createLocalePref()` works with
 * no arguments.
 */
export function createLocalePref(options: LocalePrefOptions = {}): LocalePref {
  assertOptions(options);

  const storage: StorageAdapter = options.storage ?? cookieAdapter();
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  const fallback = options.fallback ?? [NAVIGATOR_SOURCE];
  const defaultLocale = options.defaultLocale ?? DEFAULT_LOCALE;
  const storageSetOptions = options.storageSetOptions;
  const normalize = options.normalize ?? true;
  const onError = options.onError;

  const reportError = (error: unknown, context: 'storage' | 'navigator'): void => {
    onError?.(error, context);
  };

  /** Coerce a raw candidate into a returnable tag, or `null` when it is a miss. */
  const resolveCandidate = (value: unknown): string | null => {
    if (typeof value !== 'string' || value === '') return null;
    if (!normalize) return value;
    return normalizeLocale(value);
  };

  const resolveDefault = (): string => {
    if (!normalize) return defaultLocale;
    return normalizeLocale(defaultLocale) ?? FALLBACK_LOCALE;
  };

  const readStored = async (): Promise<unknown> => {
    try {
      return await storage.get(storageKey);
    } catch (error) {
      reportError(error, 'storage');
      return null;
    }
  };

  const readStoredSync = (): unknown => {
    try {
      return storage.get(storageKey);
    } catch (error) {
      reportError(error, 'storage');
      return null;
    }
  };

  const readNavigator = (): string | null => {
    try {
      return detectNavigatorLocale();
    } catch (error) {
      reportError(error, 'navigator');
      return null;
    }
  };

  const walkFallback = (readNavigatorLocale: () => string | null): string | null => {
    for (const source of fallback) {
      if (source === NAVIGATOR_SOURCE) {
        const navigatorLocale = readNavigatorLocale();
        if (navigatorLocale !== null) return navigatorLocale;
        continue;
      }
      const candidate = resolveCandidate(source);
      if (candidate !== null) return candidate;
    }
    return null;
  };

  const getLocale = async (): Promise<string> => {
    const stored = resolveCandidate(await readStored());
    if (stored !== null) return stored;
    const fromFallback = walkFallback(readNavigator);
    return fromFallback ?? resolveDefault();
  };

  const getLocaleSync = (): string => {
    if (storage.isSync !== true) {
      throw new Error('getLocaleSync() requires a synchronous storage adapter');
    }
    const stored = resolveCandidate(readStoredSync());
    if (stored !== null) return stored;
    const fromFallback = walkFallback(readNavigator);
    return fromFallback ?? resolveDefault();
  };

  return {
    get storage() {
      return storage;
    },

    normalizeLocale,

    isRegion(locale: string, region: string): boolean {
      return isRegionTag(locale, region);
    },

    async isCurrentRegion(region: string): Promise<boolean> {
      return isRegionTag(await getLocale(), region);
    },

    getLocale,

    getLocaleSync,

    async setLocale(locale: string): Promise<void> {
      let value = locale;
      if (normalize) {
        const normalized = normalizeLocale(locale);
        if (normalized === null) {
          throw new RangeError(`Invalid locale tag: ${String(locale)}`);
        }
        value = normalized;
      }
      await storage.set(storageKey, value, storageSetOptions);
    },

    async clearLocale(): Promise<void> {
      await storage.remove(storageKey);
    },
  };
}

export { cookieAdapter } from './adapters/cookie.js';
export { localStorageAdapter } from './adapters/localStorage.js';
export { memoryAdapter } from './adapters/memory.js';
export type { CookieAdapter, CookieAdapterOptions } from './adapters/cookie.js';
export type { LocalStorageAdapterOptions } from './adapters/localStorage.js';
export type { LocalePref, LocalePrefOptions, StorageAdapter, StorageSetOptions } from './types.js';
