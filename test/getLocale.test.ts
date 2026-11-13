import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalePref, memoryAdapter } from '../src/index.js';
import type { StorageAdapter } from '../src/types.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubNavigator = (languages: unknown): void => {
  vi.stubGlobal('navigator', { languages });
};

describe('getLocale fallback chain', () => {
  it('returns the stored value without falling back', async () => {
    stubNavigator(['en-US']);
    const pref = createLocalePref({ storage: memoryAdapter({ user_locale: 'zh-CN' }) });
    await expect(pref.getLocale()).resolves.toBe('zh-CN');
  });

  it('normalizes the stored value', async () => {
    const pref = createLocalePref({ storage: memoryAdapter({ user_locale: 'zh-hans-cn' }) });
    await expect(pref.getLocale()).resolves.toBe('zh-Hans-CN');
  });

  it('falls back to navigator.languages[0] when storage is empty', async () => {
    stubNavigator(['fr-FR', 'en-US']);
    const pref = createLocalePref({ storage: memoryAdapter() });
    await expect(pref.getLocale()).resolves.toBe('fr-FR');
  });

  it('skips an invalid stored value when normalize is enabled', async () => {
    stubNavigator(['de-DE']);
    const pref = createLocalePref({ storage: memoryAdapter({ user_locale: 'not a tag!!' }) });
    await expect(pref.getLocale()).resolves.toBe('de-DE');
  });

  it('returns an invalid stored value verbatim when normalize is disabled', async () => {
    stubNavigator(['de-DE']);
    const pref = createLocalePref({ storage: memoryAdapter({ user_locale: 'not a tag!!' }), normalize: false });
    await expect(pref.getLocale()).resolves.toBe('not a tag!!');
  });

  it('treats an empty stored value as a miss', async () => {
    stubNavigator(['it-IT']);
    const pref = createLocalePref({ storage: memoryAdapter({ user_locale: '' }) });
    await expect(pref.getLocale()).resolves.toBe('it-IT');
  });

  it('falls back to a fixed locale when navigator is absent', async () => {
    vi.stubGlobal('navigator', undefined);
    const pref = createLocalePref({ storage: memoryAdapter(), fallback: ['navigator', 'pt-BR'] });
    await expect(pref.getLocale()).resolves.toBe('pt-BR');
  });

  it('returns defaultLocale when every source misses', async () => {
    vi.stubGlobal('navigator', undefined);
    const pref = createLocalePref({ storage: memoryAdapter(), fallback: [], defaultLocale: 'ja-JP' });
    await expect(pref.getLocale()).resolves.toBe('ja-JP');
  });

  it('skips an invalid fixed fallback candidate before reaching defaultLocale', async () => {
    vi.stubGlobal('navigator', undefined);
    const pref = createLocalePref({ storage: memoryAdapter(), fallback: ['not a tag!!'], defaultLocale: 'ja-JP' });
    await expect(pref.getLocale()).resolves.toBe('ja-JP');
  });

  it('normalizes defaultLocale', async () => {
    vi.stubGlobal('navigator', undefined);
    const pref = createLocalePref({ storage: memoryAdapter(), fallback: [], defaultLocale: 'zh-hans-cn' });
    await expect(pref.getLocale()).resolves.toBe('zh-Hans-CN');
  });

  it('returns en when defaultLocale is invalid and normalize is enabled', async () => {
    vi.stubGlobal('navigator', undefined);
    const pref = createLocalePref({ storage: memoryAdapter(), fallback: [], defaultLocale: '!!' });
    await expect(pref.getLocale()).resolves.toBe('en');
  });

  it('returns an invalid defaultLocale verbatim when normalize is disabled', async () => {
    vi.stubGlobal('navigator', undefined);
    const pref = createLocalePref({
      storage: memoryAdapter(),
      fallback: [],
      defaultLocale: '!!',
      normalize: false,
    });
    await expect(pref.getLocale()).resolves.toBe('!!');
  });

  it('continues the chain and reports when storage.get throws', async () => {
    stubNavigator(['ko-KR']);
    const onError = vi.fn();
    const storage: StorageAdapter = {
      get() {
        throw new Error('boom');
      },
      set() {},
      remove() {},
    };
    const pref = createLocalePref({ storage, onError });
    await expect(pref.getLocale()).resolves.toBe('ko-KR');
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'storage');
  });

  it('reports and continues when the navigator source throws', async () => {
    const onError = vi.fn();
    const pref = createLocalePref({
      storage: memoryAdapter(),
      fallback: ['navigator', 'sv-SE'],
      onError,
    });
    // A throwing `languages` getter exercises the guard without depending on
    // whether the runtime defines `globalThis.navigator` (Node 20 does not).
    vi.stubGlobal('navigator', {
      get languages(): never {
        throw new Error('navigator exploded');
      },
    });
    await expect(pref.getLocale()).resolves.toBe('sv-SE');
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'navigator');
  });

  it('supports a fully asynchronous adapter', async () => {
    const store = new Map<string, string>([['user_locale', 'nl-NL']]);
    const storage: StorageAdapter = {
      async get(key) {
        return store.get(key) ?? null;
      },
      async set(key, value) {
        store.set(key, value);
      },
      async remove(key) {
        store.delete(key);
      },
    };
    const pref = createLocalePref({ storage });
    await expect(pref.getLocale()).resolves.toBe('nl-NL');
  });
});

describe('getLocaleSync', () => {
  it('matches getLocale for a synchronous adapter', async () => {
    stubNavigator(['en-GB']);
    const pref = createLocalePref({ storage: memoryAdapter({ user_locale: 'es-ES' }) });
    expect(pref.getLocaleSync()).toBe(await pref.getLocale());
    expect(pref.getLocaleSync()).toBe('es-ES');
  });

  it('falls back synchronously to navigator', () => {
    stubNavigator(['en-GB']);
    const pref = createLocalePref({ storage: memoryAdapter() });
    expect(pref.getLocaleSync()).toBe('en-GB');
  });

  it('falls back synchronously to a fixed candidate and reports a sync storage error', () => {
    vi.stubGlobal('navigator', undefined);
    const onError = vi.fn();
    const storage: StorageAdapter = {
      isSync: true,
      get() {
        throw new Error('sync boom');
      },
      set: () => undefined,
      remove: () => undefined,
    };
    const pref = createLocalePref({ storage, fallback: ['not a tag!!', 'nb-NO'], onError });
    expect(pref.getLocaleSync()).toBe('nb-NO');
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'storage');
  });

  it('falls back synchronously to defaultLocale when every source misses', () => {
    vi.stubGlobal('navigator', undefined);
    const pref = createLocalePref({ storage: memoryAdapter(), fallback: [], defaultLocale: 'pl-PL' });
    expect(pref.getLocaleSync()).toBe('pl-PL');
  });

  it('throws for an adapter without isSync', () => {
    const storage: StorageAdapter = {
      async get() {
        return null;
      },
      async set() {},
      async remove() {},
    };
    const pref = createLocalePref({ storage });
    expect(() => pref.getLocaleSync()).toThrow('getLocaleSync() requires a synchronous storage adapter');
  });

  it('throws for an adapter that explicitly sets isSync to false', () => {
    const storage: StorageAdapter = {
      isSync: false,
      get: () => null,
      set: () => undefined,
      remove: () => undefined,
    };
    expect(() => createLocalePref({ storage }).getLocaleSync()).toThrow(
      'getLocaleSync() requires a synchronous storage adapter',
    );
  });

  it('continues the chain and reports when a synchronous get throws', () => {
    stubNavigator(['da-DK']);
    const onError = vi.fn();
    const storage: StorageAdapter = {
      isSync: true,
      get() {
        throw new Error('sync boom');
      },
      set: () => undefined,
      remove: () => undefined,
    };
    const pref = createLocalePref({ storage, onError });
    expect(pref.getLocaleSync()).toBe('da-DK');
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'storage');
  });
});

describe('missing Intl.Locale', () => {
  const withIntlLocale = (value: unknown, fn: () => void): void => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Locale');
    try {
      Object.defineProperty(Intl, 'Locale', { value, configurable: true, writable: true });
      fn();
    } finally {
      if (descriptor) Object.defineProperty(Intl, 'Locale', descriptor);
      else delete (Intl as { Locale?: unknown }).Locale;
    }
  };

  it('throws from getLocaleSync when normalize is enabled', () => {
    vi.stubGlobal('navigator', { languages: ['fr-FR'] });
    const pref = createLocalePref({ storage: memoryAdapter(), fallback: ['navigator'] });
    let error: unknown;
    withIntlLocale(undefined, () => {
      try {
        pref.getLocaleSync();
      } catch (caught) {
        error = caught;
      }
    });
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/Intl\.Locale/);
  });

  it('reports the navigator failure and still resolves with normalize disabled', () => {
    vi.stubGlobal('navigator', { languages: ['fr-FR'] });
    const onError = vi.fn();
    const pref = createLocalePref({
      storage: memoryAdapter(),
      fallback: ['navigator'],
      normalize: false,
      defaultLocale: 'en',
      onError,
    });
    let locale = '';
    withIntlLocale(undefined, () => {
      locale = pref.getLocaleSync();
    });
    expect(locale).toBe('en');
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'navigator');
  });

  it('rejects setLocale when normalize is enabled', async () => {
    const pref = createLocalePref({ storage: memoryAdapter() });
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Locale');
    try {
      Object.defineProperty(Intl, 'Locale', { value: undefined, configurable: true, writable: true });
      await expect(pref.setLocale('zh-CN')).rejects.toThrow(/Intl\.Locale/);
    } finally {
      if (descriptor) Object.defineProperty(Intl, 'Locale', descriptor);
    }
  });

  it('still reads and writes raw tags when normalize is disabled', async () => {
    const storage = memoryAdapter();
    const pref = createLocalePref({ storage, normalize: false, fallback: [], defaultLocale: 'en' });
    let locale = '';
    withIntlLocale(undefined, () => {
      locale = pref.getLocaleSync();
    });
    expect(locale).toBe('en');
    // normalize: false is the documented escape hatch that avoids Intl.Locale.
    await pref.setLocale('zh-CN');
    expect(storage.get('user_locale')).toBe('zh-CN');
  });
});
