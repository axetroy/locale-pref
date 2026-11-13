import { describe, expect, it } from 'vitest';
import { createLocalePref, memoryAdapter } from '../src/index.js';
import type { StorageAdapter } from '../src/types.js';

/**
 * Pins the sequencing of writes through a synchronous adapter.
 *
 * `setLocale` is declared `async`, but `await` on a non-thenable evaluates the
 * adapter's synchronous body before the call returns, so a sync write is already
 * observable without awaiting. These tests keep that behavior from regressing if
 * the methods are ever restructured, and document why there is no
 * `setLocaleSync()`.
 */
describe('writes through a synchronous adapter', () => {
  it('writes before setLocale() returns, without awaiting', () => {
    const storage = memoryAdapter();
    const pref = createLocalePref({ storage });

    void pref.setLocale('zh-CN');

    expect(storage.get('user_locale')).toBe('zh-CN');
  });

  it('removes before clearLocale() returns, without awaiting', () => {
    const storage = memoryAdapter({ user_locale: 'zh-CN' });
    const pref = createLocalePref({ storage });

    void pref.clearLocale();

    expect(storage.get('user_locale')).toBe(null);
  });

  it('runs the adapter body before the method call returns', () => {
    const events: string[] = [];
    const storage: StorageAdapter = {
      isSync: true,
      get: () => null,
      set: () => {
        events.push('set');
      },
      remove: () => {
        events.push('remove');
      },
    };
    const pref = createLocalePref({ storage });

    pref.setLocale('en-US');
    events.push('after-set');
    pref.clearLocale();
    events.push('after-remove');

    expect(events).toEqual(['set', 'after-set', 'remove', 'after-remove']);
  });

  it('a synchronous set failure rejects the returned promise instead of throwing', async () => {
    const storage: StorageAdapter = {
      isSync: true,
      get: () => null,
      set: () => {
        throw new Error('sync write failed');
      },
      remove: () => undefined,
    };
    const pref = createLocalePref({ storage });

    const returned = pref.setLocale('en-US');
    expect(returned).toBeInstanceOf(Promise);
    await expect(returned).rejects.toThrow('sync write failed');
  });
});
