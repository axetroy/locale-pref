import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalePref, memoryAdapter } from '../src/index.js';
import type { StorageAdapter, StorageSetOptions } from '../src/types.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const stubNavigator = (languages: unknown): void => {
  vi.stubGlobal('navigator', { languages });
};

describe('setLocale', () => {
  it('writes to the configured storageKey', async () => {
    const storage = memoryAdapter();
    const pref = createLocalePref({ storage, storageKey: 'lang' });
    await pref.setLocale('zh-CN');
    expect(storage.get('lang')).toBe('zh-CN');
  });

  it('writes the normalized tag when normalize is enabled', async () => {
    const storage = memoryAdapter();
    const pref = createLocalePref({ storage });
    await pref.setLocale('zh-hans-cn');
    expect(storage.get('user_locale')).toBe('zh-Hans-CN');
  });

  it('writes the raw tag when normalize is disabled', async () => {
    const storage = memoryAdapter();
    const pref = createLocalePref({ storage, normalize: false });
    await pref.setLocale('not a tag!!');
    expect(storage.get('user_locale')).toBe('not a tag!!');
  });

  it('throws RangeError for an invalid tag when normalize is enabled', async () => {
    const pref = createLocalePref({ storage: memoryAdapter() });
    await expect(pref.setLocale('!!')).rejects.toThrow(RangeError);
    await expect(pref.setLocale('!!')).rejects.toThrow(/!!/);
  });

  it('rejects a non-string tag even when normalize is disabled', async () => {
    const pref = createLocalePref({ storage: memoryAdapter(), normalize: false });
    await expect(pref.setLocale(123 as unknown as string)).rejects.toThrow(TypeError);
  });

  it('forwards storageSetOptions to the adapter', async () => {
    const received: Array<StorageSetOptions | undefined> = [];
    const storage: StorageAdapter = {
      get: () => null,
      set(_key, _value, options) {
        received.push(options);
      },
      remove: () => undefined,
    };
    const options: StorageSetOptions = { maxAge: 120, path: '/app', secure: true };
    const pref = createLocalePref({ storage, storageSetOptions: options });
    await pref.setLocale('en-US');
    expect(received[0]).toBe(options);
  });

  it('supports an asynchronous adapter', async () => {
    const store = new Map<string, string>();
    const storage: StorageAdapter = {
      async get(key) {
        return store.get(key) ?? null;
      },
      async set(key, value) {
        await Promise.resolve();
        store.set(key, value);
      },
      async remove(key) {
        store.delete(key);
      },
    };
    const pref = createLocalePref({ storage });
    await pref.setLocale('fr-CA');
    expect(store.get('user_locale')).toBe('fr-CA');
  });

  it('round-trips through getLocale', async () => {
    const pref = createLocalePref({ storage: memoryAdapter() });
    await pref.setLocale('de-AT');
    await expect(pref.getLocale()).resolves.toBe('de-AT');
  });
});

describe('clearLocale', () => {
  it('removes the stored value', async () => {
    const storage = memoryAdapter({ user_locale: 'zh-CN' });
    const pref = createLocalePref({ storage });
    await pref.clearLocale();
    expect(storage.get('user_locale')).toBe(null);
  });

  it('forwards storageSetOptions to remove', async () => {
    const received: Array<StorageSetOptions | undefined> = [];
    const storage: StorageAdapter = {
      get: () => 'zh-CN',
      set: () => undefined,
      remove: (_key, options) => void received.push(options),
    };
    const options: StorageSetOptions = { path: '/app', domain: 'example.com' };
    await createLocalePref({ storage, storageSetOptions: options }).clearLocale();
    expect(received[0]).toBe(options);
  });

  it('supports an asynchronous adapter', async () => {
    const store = new Map<string, string>([['user_locale', 'zh-CN']]);
    const storage: StorageAdapter = {
      get: (key) => store.get(key) ?? null,
      set: (key, value) => void store.set(key, value),
      async remove(key) {
        await Promise.resolve();
        store.delete(key);
      },
    };
    const pref = createLocalePref({ storage });
    await pref.clearLocale();
    expect(store.has('user_locale')).toBe(false);
  });
});

describe('instance surface', () => {
  it('exposes the storage adapter it was created with', () => {
    const storage = memoryAdapter();
    expect(createLocalePref({ storage }).storage).toBe(storage);
  });

  it('defaults to a cookie adapter', () => {
    const pref = createLocalePref();
    expect(pref.storage.isSync).toBe(true);
  });

  it('delegates normalizeLocale to the utility', () => {
    expect(createLocalePref().normalizeLocale('zh-hans-cn')).toBe('zh-Hans-CN');
    expect(createLocalePref().normalizeLocale('!!')).toBe(null);
  });

  it('delegates isRegion to the utility', () => {
    const pref = createLocalePref();
    expect(pref.isRegion('zh-CN', 'cn')).toBe(true);
    expect(pref.isRegion('zh', 'CN')).toBe(false);
    expect(pref.isRegion('invalid_tag!!', 'CN')).toBe(false);
  });

  it('delegates isLanguage to the utility', () => {
    const pref = createLocalePref();
    expect(pref.isLanguage('zh-Hans-CN', 'zh')).toBe(true);
    expect(pref.isLanguage('zh-Hans-CN', 'en')).toBe(false);
    expect(pref.isLanguage('invalid_tag!!', 'zh')).toBe(false);
  });

  it('delegates isScript to the utility', () => {
    const pref = createLocalePref();
    expect(pref.isScript('zh-Hans-CN', 'Hans')).toBe(true);
    expect(pref.isScript('zh-TW', 'Hant')).toBe(true);
    expect(pref.isScript('zh-TW', 'Hans')).toBe(false);
    expect(pref.isScript('invalid_tag!!', 'Hans')).toBe(false);
  });

  it('reports isCurrentRegion for the resolved locale', async () => {
    stubNavigator(['en-US']);
    const pref = createLocalePref({ storage: memoryAdapter({ user_locale: 'zh-Hans-CN' }) });
    await expect(pref.isCurrentRegion('CN')).resolves.toBe(true);
    await expect(pref.isCurrentRegion('US')).resolves.toBe(false);
  });

  it('reports isCurrentLanguage for the resolved locale', async () => {
    stubNavigator(['en-US']);
    const pref = createLocalePref({ storage: memoryAdapter({ user_locale: 'zh-Hans-CN' }) });
    await expect(pref.isCurrentLanguage('zh')).resolves.toBe(true);
    await expect(pref.isCurrentLanguage('en')).resolves.toBe(false);
  });

  it('reports isCurrentScript for the resolved locale', async () => {
    stubNavigator(['en-US']);
    const pref = createLocalePref({ storage: memoryAdapter({ user_locale: 'zh-TW' }) });
    await expect(pref.isCurrentScript('Hant')).resolves.toBe(true);
    await expect(pref.isCurrentScript('Hans')).resolves.toBe(false);
  });
});

describe('option validation', () => {
  it('accepts an empty fallback array', async () => {
    vi.stubGlobal('navigator', undefined);
    const pref = createLocalePref({ storage: memoryAdapter(), fallback: [] });
    await expect(pref.getLocale()).resolves.toBe('en');
  });

  it('snapshots the fallback array so later mutation cannot change it', async () => {
    vi.stubGlobal('navigator', undefined);
    const fallback: string[] = [];
    const pref = createLocalePref({ storage: memoryAdapter(), fallback, defaultLocale: 'de' });
    fallback.push('en');
    await expect(pref.getLocale()).resolves.toBe('de');
  });

  it('rejects a non-object storage', () => {
    expect(() => createLocalePref({ storage: 'not-an-object' as unknown as StorageAdapter })).toThrow(TypeError);
    expect(() => createLocalePref({ storage: 'not-an-object' as unknown as StorageAdapter })).toThrow(/storage/);
  });

  it('rejects a null storage', () => {
    expect(() => createLocalePref({ storage: null as unknown as StorageAdapter })).toThrow(TypeError);
  });

  it('rejects a non-array fallback', () => {
    expect(() => createLocalePref({ fallback: 'navigator' as unknown as string[] })).toThrow(TypeError);
    expect(() => createLocalePref({ fallback: 'navigator' as unknown as string[] })).toThrow(/fallback/);
  });

  it('rejects non-string fallback entries', () => {
    expect(() => createLocalePref({ fallback: [123] as unknown as string[] })).toThrow(/fallback/);
    expect(() => createLocalePref({ fallback: ['en', null] as unknown as string[] })).toThrow(TypeError);
  });

  it('rejects a storage object missing adapter methods', () => {
    expect(() => createLocalePref({ storage: {} as unknown as StorageAdapter })).toThrow(TypeError);
    expect(() => createLocalePref({ storage: { get: () => null } as unknown as StorageAdapter })).toThrow(/storage/);
  });

  it('rejects a non-string storageKey', () => {
    expect(() => createLocalePref({ storageKey: 1 as unknown as string })).toThrow(/storageKey/);
  });

  it('rejects an empty storageKey', () => {
    expect(() => createLocalePref({ storageKey: '' })).toThrow(/storageKey/);
  });

  it('rejects a non-string defaultLocale', () => {
    expect(() => createLocalePref({ defaultLocale: 1 as unknown as string })).toThrow(/defaultLocale/);
  });

  it('rejects an empty defaultLocale', () => {
    expect(() => createLocalePref({ defaultLocale: '' })).toThrow(/defaultLocale/);
  });

  it('rejects a non-boolean normalize', () => {
    expect(() => createLocalePref({ normalize: 'yes' as unknown as boolean })).toThrow(/normalize/);
  });

  it('rejects a non-object storageSetOptions', () => {
    expect(() => createLocalePref({ storageSetOptions: 'x' as unknown as StorageSetOptions })).toThrow(
      /storageSetOptions/,
    );
  });

  it('rejects a non-function onError', () => {
    expect(() => createLocalePref({ onError: 1 as unknown as () => void })).toThrow(/onError/);
  });

  it('accepts a fully specified option set', () => {
    const pref = createLocalePref({
      storage: memoryAdapter(),
      storageKey: 'lang',
      fallback: ['navigator', 'en'],
      defaultLocale: 'en-US',
      storageSetOptions: { maxAge: 1 },
      normalize: false,
      onError: () => undefined,
    });
    expect(pref.storage.isSync).toBe(true);
  });
});
