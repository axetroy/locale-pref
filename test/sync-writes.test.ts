import { describe, expect, it } from 'vitest';
import { createLocalePref, memoryAdapter } from '../src/index.js';
import type { StorageAdapter } from '../src/types.js';

/**
 * The `*Sync` methods let a fully synchronous flow stay synchronous: no
 * `Promise` is returned, so a callback that writes a locale does not become a
 * floating promise that `@typescript-eslint/no-floating-promises` rejects.
 */
describe('setLocaleSync', () => {
  it('writes synchronously and returns nothing', () => {
    const storage = memoryAdapter();
    const pref = createLocalePref({ storage });

    const returned = pref.setLocaleSync('zh-CN');

    expect(returned).toBeUndefined();
    expect(storage.get('user_locale')).toBe('zh-CN');
    expect(pref.getLocaleSync()).toBe('zh-CN');
  });

  it('canonicalizes the tag when normalize is enabled', () => {
    const storage = memoryAdapter();
    createLocalePref({ storage }).setLocaleSync('zh-hans-cn');
    expect(storage.get('user_locale')).toBe('zh-Hans-CN');
  });

  it('writes the raw tag when normalize is disabled', () => {
    const storage = memoryAdapter();
    createLocalePref({ storage, normalize: false }).setLocaleSync('not a tag!!');
    expect(storage.get('user_locale')).toBe('not a tag!!');
  });

  it('throws RangeError for an invalid tag when normalize is enabled', () => {
    const pref = createLocalePref({ storage: memoryAdapter() });
    expect(() => pref.setLocaleSync('!!')).toThrow(RangeError);
  });

  it('forwards storageSetOptions to the adapter', () => {
    const received: Array<unknown> = [];
    const storage: StorageAdapter = {
      isSync: true,
      get: () => null,
      set: (_key, _value, options) => void received.push(options),
      remove: () => undefined,
    };
    const options = { maxAge: 120, path: '/app' };
    createLocalePref({ storage, storageSetOptions: options }).setLocaleSync('en-US');
    expect(received[0]).toBe(options);
  });

  it('propagates a synchronous adapter failure as a throw', () => {
    const storage: StorageAdapter = {
      isSync: true,
      get: () => null,
      set: () => {
        throw new Error('quota exceeded');
      },
      remove: () => undefined,
    };
    expect(() => createLocalePref({ storage }).setLocaleSync('en-US')).toThrow('quota exceeded');
  });

  it('requires a synchronous adapter', () => {
    const storage: StorageAdapter = {
      get: async () => null,
      set: async () => undefined,
      remove: async () => undefined,
    };
    expect(() => createLocalePref({ storage }).setLocaleSync('en-US')).toThrow(
      'setLocaleSync() requires a synchronous storage adapter',
    );
  });
});

describe('clearLocaleSync', () => {
  it('removes synchronously and returns nothing', () => {
    const storage = memoryAdapter({ user_locale: 'zh-CN' });
    const pref = createLocalePref({ storage });

    const returned = pref.clearLocaleSync();

    expect(returned).toBeUndefined();
    expect(storage.get('user_locale')).toBe(null);
  });

  it('forwards storageSetOptions to remove', () => {
    const received: Array<unknown> = [];
    const storage: StorageAdapter = {
      isSync: true,
      get: () => 'zh-CN',
      set: () => undefined,
      remove: (_key, options) => void received.push(options),
    };
    const options = { path: '/app', domain: 'example.com' };
    createLocalePref({ storage, storageSetOptions: options }).clearLocaleSync();
    expect(received[0]).toBe(options);
  });

  it('propagates a synchronous adapter failure as a throw', () => {
    const storage: StorageAdapter = {
      isSync: true,
      get: () => null,
      set: () => undefined,
      remove: () => {
        throw new Error('remove failed');
      },
    };
    expect(() => createLocalePref({ storage }).clearLocaleSync()).toThrow('remove failed');
  });

  it('requires a synchronous adapter', () => {
    const storage: StorageAdapter = {
      get: async () => null,
      set: async () => undefined,
      remove: async () => undefined,
    };
    expect(() => createLocalePref({ storage }).clearLocaleSync()).toThrow(
      'clearLocaleSync() requires a synchronous storage adapter',
    );
  });
});

describe('isCurrentRegionSync', () => {
  it('judges the stored region synchronously', () => {
    const pref = createLocalePref({ storage: memoryAdapter({ user_locale: 'zh-Hans-CN' }) });
    expect(pref.isCurrentRegionSync('CN')).toBe(true);
    expect(pref.isCurrentRegionSync('US')).toBe(false);
  });

  it('requires a synchronous adapter', () => {
    const storage: StorageAdapter = {
      get: async () => null,
      set: async () => undefined,
      remove: async () => undefined,
    };
    expect(() => createLocalePref({ storage }).isCurrentRegionSync('CN')).toThrow(
      'isCurrentRegionSync() requires a synchronous storage adapter',
    );
  });
});

describe('a fully synchronous flow', () => {
  it('never produces a promise', () => {
    const storage = memoryAdapter();
    const pref = createLocalePref({ storage });

    const returned = [pref.setLocaleSync('ja-JP'), pref.clearLocaleSync()];

    expect(returned.every((value) => value === undefined)).toBe(true);
    expect(storage.get('user_locale')).toBe(null);
  });
});
