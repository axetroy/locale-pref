import type { StorageAdapter, StorageSetOptions } from '../types.js';

export interface CookieAdapterOptions {
  /** Cookie header used for reads outside the browser (for example in SSR). */
  cookieString?: string;
  /** Default cookie path. Defaults to `'/'`. */
  defaultPath?: string;
  /** Default cookie lifetime in seconds. Defaults to one year. */
  defaultMaxAge?: number;
}

/**
 * Cookie adapter with an extended `remove` signature so the deletion cookie can
 * carry the same `path`/`domain` attributes as the value it replaces.
 */
export interface CookieAdapter extends StorageAdapter {
  remove(key: string, options?: StorageSetOptions): void;
}

const ONE_YEAR_IN_SECONDS = 31_536_000;

interface CookieEnvironment {
  isBrowser: boolean;
  readCookieString: () => string;
  writeCookie: (value: string) => void;
}

function resolveEnvironment(cookieString: string | undefined): CookieEnvironment {
  if (typeof document !== 'undefined' && typeof document.cookie === 'string') {
    return {
      isBrowser: true,
      readCookieString: () => document.cookie,
      writeCookie: (value) => {
        document.cookie = value;
      },
    };
  }
  return {
    isBrowser: false,
    readCookieString: () => cookieString ?? '',
    writeCookie: () => {
      throw new Error('cookieAdapter is read-only in Node.js environment');
    },
  };
}

function parseCookieValue(cookieString: string, key: string): string | null {
  for (const part of cookieString.split(';')) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex === -1) continue;
    if (part.slice(0, separatorIndex).trim() !== key) continue;
    const raw = part.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/**
 * Cookie-backed adapter. Reads `document.cookie` in the browser and the
 * provided `cookieString` elsewhere. Writing is a no-op that throws outside the
 * browser, where the adapter is read-only.
 */
export function cookieAdapter(options: CookieAdapterOptions = {}): CookieAdapter {
  const defaultPath = options.defaultPath ?? '/';
  const defaultMaxAge = options.defaultMaxAge ?? ONE_YEAR_IN_SECONDS;
  const environment = resolveEnvironment(options.cookieString);

  const serialize = (key: string, value: string, maxAge: number, setOptions: StorageSetOptions): string => {
    const attributes = [`${key}=${encodeURIComponent(value)}`];
    attributes.push(`path=${setOptions.path ?? defaultPath}`);
    attributes.push(`max-age=${setOptions.maxAge ?? maxAge}`);
    attributes.push(`SameSite=${setOptions.sameSite ?? 'Lax'}`);
    if (setOptions.secure === true) attributes.push('Secure');
    if (setOptions.domain) attributes.push(`domain=${setOptions.domain}`);
    return attributes.join('; ');
  };

  return {
    isSync: true,
    get(key) {
      return parseCookieValue(environment.readCookieString(), key);
    },
    set(key, value, setOptions = {}) {
      environment.writeCookie(serialize(key, value, defaultMaxAge, setOptions));
    },
    remove(key, setOptions = {}) {
      environment.writeCookie(serialize(key, '', 0, setOptions));
    },
  };
}
