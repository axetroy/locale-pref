/**
 * Options forwarded to {@link StorageAdapter.set} when persisting a locale.
 */
export interface StorageSetOptions {
  /** Cookie lifetime in seconds. */
  maxAge?: number;
  /** Cookie path. */
  path?: string;
  /** Cookie SameSite policy. */
  sameSite?: 'Strict' | 'Lax' | 'None';
  /** Adds the `Secure` attribute when `true`. */
  secure?: boolean;
  /** Cookie domain. */
  domain?: string;
}

/**
 * Pluggable persistence backend.
 *
 * Adapters may be synchronous or asynchronous. Synchronous adapters should set
 * `isSync` to `true` so that {@link LocalePref.getLocaleSync} can use them.
 */
export interface StorageAdapter {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string, options?: StorageSetOptions): void | Promise<void>;
  /**
   * Remove a stored value. `options` carries the same attributes the value was
   * written with (for example a cookie `path`/`domain`), so a backend that
   * scopes entries by attribute can delete the right one.
   */
  remove(key: string, options?: StorageSetOptions): void | Promise<void>;
  /** Marks the adapter as synchronous. */
  readonly isSync?: boolean;
}

/** Construction options for {@link createLocalePref}. */
export interface LocalePrefOptions {
  /** Storage backend. Defaults to {@link cookieAdapter}. */
  storage?: StorageAdapter;
  /** Key used inside the storage backend. Defaults to `'user_locale'`. */
  storageKey?: string;
  /**
   * Sources tried when storage misses, in order. The reserved string
   * `'navigator'` reads `navigator.languages`; any other string is a fixed
   * locale candidate. Defaults to `['navigator']`.
   */
  fallback?: Array<'navigator' | string>;
  /** Last-resort locale. Defaults to `'en'`. */
  defaultLocale?: string;
  /** Default options passed to `storage.set`. */
  storageSetOptions?: StorageSetOptions;
  /** Validate and canonicalize tags. Defaults to `true`. */
  normalize?: boolean;
  /** Called when storage or navigator access throws. Silent by default. */
  onError?: (error: unknown, context: 'storage' | 'navigator') => void;
}

/** Public instance returned by {@link createLocalePref}. */
export interface LocalePref {
  getLocale(): Promise<string>;
  getLocaleSync(): string;
  setLocale(locale: string): Promise<void>;
  setLocaleSync(locale: string): void;
  clearLocale(): Promise<void>;
  clearLocaleSync(): void;
  /**
   * Whether the current locale carries `region`. For a pure check against an
   * arbitrary tag, use {@link isRegion} from `locale-pref/utils`.
   */
  isRegion(region: string): Promise<boolean>;
  /** Synchronous twin of {@link isRegion}; requires a synchronous adapter. */
  isRegionSync(region: string): boolean;
  /**
   * Whether the current locale's primary language subtag is `language`. For a
   * pure check against an arbitrary tag, use {@link isLanguage} from
   * `locale-pref/utils`.
   */
  isLanguage(language: string): Promise<boolean>;
  /** Synchronous twin of {@link isLanguage}; requires a synchronous adapter. */
  isLanguageSync(language: string): boolean;
  /**
   * Whether the current locale resolves to `script`. For a pure check against an
   * arbitrary tag, use {@link isScript} from `locale-pref/utils`.
   */
  isScript(script: string): Promise<boolean>;
  /** Synchronous twin of {@link isScript}; requires a synchronous adapter. */
  isScriptSync(script: string): boolean;
  /** The adapter this instance was created with. */
  readonly storage: StorageAdapter;
}
