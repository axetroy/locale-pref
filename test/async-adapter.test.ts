import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalePref } from '../src/index.js';
import type { StorageAdapter } from '../src/types.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** A Promise-based backend, standing in for Redis / IndexedDB / `fetch`. */
function asyncAdapter(initial?: Record<string, string>) {
  const store = new Map<string, string>(initial ? Object.entries(initial) : undefined);
  return {
    store,
    adapter: {
      async get(key: string): Promise<string | null> {
        return store.get(key) ?? null;
      },
      async set(key: string, value: string): Promise<void> {
        store.set(key, value);
      },
      async remove(key: string): Promise<void> {
        store.delete(key);
      },
    } satisfies StorageAdapter,
  };
}

describe('asynchronous adapters', () => {
  it('awaits storage.get and returns the stored value', async () => {
    const { adapter } = asyncAdapter({ user_locale: 'nl-NL' });
    await expect(createLocalePref({ storage: adapter }).getLocale()).resolves.toBe('nl-NL');
  });

  it('awaits storage.set so the write is visible on the next read', async () => {
    const { store, adapter } = asyncAdapter();
    const pref = createLocalePref({ storage: adapter });
    await pref.setLocale('zh-hans-cn');
    expect(store.get('user_locale')).toBe('zh-Hans-CN');
    await expect(pref.getLocale()).resolves.toBe('zh-Hans-CN');
  });

  it('awaits storage.remove', async () => {
    const { store, adapter } = asyncAdapter({ user_locale: 'en-US' });
    const pref = createLocalePref({ storage: adapter, fallback: ['en'], defaultLocale: 'en' });
    await pref.clearLocale();
    expect(store.has('user_locale')).toBe(false);
    await expect(pref.getLocale()).resolves.toBe('en');
  });

  it('resolves isRegion against the async-backed locale', async () => {
    const { adapter } = asyncAdapter({ user_locale: 'ja-JP' });
    await expect(createLocalePref({ storage: adapter }).isRegion('jp')).resolves.toBe(true);
  });

  it('resolves isLanguage against the async-backed locale', async () => {
    const { adapter } = asyncAdapter({ user_locale: 'ja-JP' });
    await expect(createLocalePref({ storage: adapter }).isLanguage('ja')).resolves.toBe(true);
  });

  it('resolves isScript against the async-backed locale', async () => {
    const { adapter } = asyncAdapter({ user_locale: 'zh-TW' });
    await expect(createLocalePref({ storage: adapter }).isScript('Hant')).resolves.toBe(true);
  });

  it('reports a rejected get through onError and falls back', async () => {
    const onError = vi.fn();
    const storage: StorageAdapter = {
      get: () => Promise.reject(new Error('redis down')),
      set: async () => undefined,
      remove: async () => undefined,
    };
    vi.stubGlobal('navigator', { languages: ['de-DE'] });
    const pref = createLocalePref({ storage, onError });
    await expect(pref.getLocale()).resolves.toBe('de-DE');
    expect(onError).toHaveBeenCalledWith(expect.any(Error), 'storage');
  });

  it('propagates a rejected set to the caller', async () => {
    const storage: StorageAdapter = {
      get: async () => null,
      set: () => Promise.reject(new Error('write refused')),
      remove: async () => undefined,
    };
    await expect(createLocalePref({ storage }).setLocale('en-US')).rejects.toThrow('write refused');
  });

  it('propagates a rejected remove to the caller', async () => {
    const storage: StorageAdapter = {
      get: async () => null,
      set: async () => undefined,
      remove: () => Promise.reject(new Error('delete refused')),
    };
    await expect(createLocalePref({ storage }).clearLocale()).rejects.toThrow('delete refused');
  });

  it('getLocaleSync throws for an adapter without isSync', () => {
    const { adapter } = asyncAdapter();
    const pref = createLocalePref({ storage: adapter });
    expect(() => pref.getLocaleSync()).toThrow('getLocaleSync() requires a synchronous storage adapter');
  });

  it('exposes the async adapter unchanged on .storage', () => {
    const { adapter } = asyncAdapter();
    expect(createLocalePref({ storage: adapter }).storage).toBe(adapter);
  });
});
