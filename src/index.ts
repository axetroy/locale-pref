import { cookieAdapter } from './adapters/cookie.js';
import { detectNavigatorLocale, isLanguage, isRegion, isScript, normalizeLocale } from './utils.js';
import type { LocalePref, LocalePrefOptions, StorageAdapter } from './types.js';

const DEFAULT_STORAGE_KEY = 'user_locale';
const DEFAULT_LOCALE = 'en';
const FALLBACK_LOCALE = 'en';
const NAVIGATOR_SOURCE = 'navigator';

function isStorageAdapter(value: unknown): value is StorageAdapter {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StorageAdapter>;
  return (
    typeof candidate.get === 'function' && typeof candidate.set === 'function' && typeof candidate.remove === 'function'
  );
}

function assertOptions(options: LocalePrefOptions): void {
  const { storage, fallback, storageKey, defaultLocale, normalize, storageSetOptions, onError } = options;

  if (storage !== undefined && !isStorageAdapter(storage)) {
    throw new TypeError('`storage` must be an object implementing the StorageAdapter interface (get/set/remove)');
  }
  if (fallback !== undefined && !Array.isArray(fallback)) {
    throw new TypeError('`fallback` must be an array');
  }
  if (fallback !== undefined && fallback.some((source) => typeof source !== 'string')) {
    throw new TypeError('`fallback` entries must be strings');
  }
  if (storageKey !== undefined && (typeof storageKey !== 'string' || storageKey === '')) {
    throw new TypeError('`storageKey` must be a non-empty string');
  }
  if (defaultLocale !== undefined && (typeof defaultLocale !== 'string' || defaultLocale === '')) {
    throw new TypeError('`defaultLocale` must be a non-empty string');
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
  // Snapshot the fallback chain so later mutation of the caller's array cannot
  // silently change this instance's resolution order.
  const fallback = options.fallback === undefined ? [NAVIGATOR_SOURCE] : [...options.fallback];
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

  const assertSyncAdapter = (method: string): void => {
    if (storage.isSync !== true) {
      throw new Error(`${method}() requires a synchronous storage adapter`);
    }
  };

  /** Validate and canonicalize a tag for writing, honoring `normalize`. */
  const normalizeForWrite = (locale: string): string => {
    if (typeof locale !== 'string') {
      throw new TypeError(`setLocale() expects a string, received ${typeof locale}`);
    }
    if (!normalize) return locale;
    const normalized = normalizeLocale(locale);
    if (normalized === null) {
      throw new RangeError(`Invalid locale tag: ${String(locale)}`);
    }
    return normalized;
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

  const resolveLocaleSync = (): string => {
    const stored = resolveCandidate(readStoredSync());
    if (stored !== null) return stored;
    const fromFallback = walkFallback(readNavigator);
    return fromFallback ?? resolveDefault();
  };

  const getLocaleSync = (): string => {
    assertSyncAdapter('getLocaleSync');
    return resolveLocaleSync();
  };

  return {
    get storage() {
      return storage;
    },

    async isRegion(region: string): Promise<boolean> {
      return isRegion(await getLocale(), region);
    },

    isRegionSync(region: string): boolean {
      assertSyncAdapter('isRegionSync');
      return isRegion(resolveLocaleSync(), region);
    },

    async isLanguage(language: string): Promise<boolean> {
      return isLanguage(await getLocale(), language);
    },

    isLanguageSync(language: string): boolean {
      assertSyncAdapter('isLanguageSync');
      return isLanguage(resolveLocaleSync(), language);
    },

    async isScript(script: string): Promise<boolean> {
      return isScript(await getLocale(), script);
    },

    isScriptSync(script: string): boolean {
      assertSyncAdapter('isScriptSync');
      return isScript(resolveLocaleSync(), script);
    },

    getLocale,

    getLocaleSync,

    async setLocale(locale: string): Promise<void> {
      await storage.set(storageKey, normalizeForWrite(locale), storageSetOptions);
    },

    setLocaleSync(locale: string): void {
      assertSyncAdapter('setLocaleSync');
      storage.set(storageKey, normalizeForWrite(locale), storageSetOptions);
    },

    async clearLocale(): Promise<void> {
      await storage.remove(storageKey, storageSetOptions);
    },

    clearLocaleSync(): void {
      assertSyncAdapter('clearLocaleSync');
      storage.remove(storageKey, storageSetOptions);
    },
  };
}

let defaultLocalePref: LocalePref | undefined;

/**
 * Lazily-created, process-wide default instance.
 *
 * Equivalent to `createLocalePref()` with no options (cookie storage,
 * `'navigator'` fallback, `'en'` default, `'user_locale'` key). It is created on
 * the first call, so importing the package stays free of side effects.
 *
 * Prefer `createLocalePref()` with an injected storage adapter. This instance is
 * shared for the lifetime of the process and always uses the `'user_locale'`
 * cookie key, so it must not be used in a multi-tenant SSR server: the locale
 * read from one request's cookie would leak into every other request. Create a
 * per-request instance there instead.
 */
export function getDefaultLocalePref(): LocalePref {
  return (defaultLocalePref ??= createLocalePref());
}

export { cookieAdapter } from './adapters/cookie.js';
export { localStorageAdapter } from './adapters/localStorage.js';
export { sessionStorageAdapter } from './adapters/sessionStorage.js';
export { memoryAdapter } from './adapters/memory.js';
export type { CookieAdapter, CookieAdapterOptions } from './adapters/cookie.js';
export type { LocalStorageAdapterOptions } from './adapters/localStorage.js';
export type { SessionStorageAdapterOptions } from './adapters/sessionStorage.js';
export type { LocalePref, LocalePrefOptions, StorageAdapter, StorageSetOptions } from './types.js';
