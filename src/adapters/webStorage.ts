import type { StorageAdapter } from '../types.js';

/**
 * Build a synchronous adapter over a `Storage`-like object (`localStorage`,
 * `sessionStorage`, or a compatible stand-in).
 *
 * `storage.setItem` errors (for example `QuotaExceededError`) are intentionally
 * left to propagate: the caller's `onError` decides how to react.
 */
export function webStorageAdapter(storage: Storage): StorageAdapter {
  return {
    isSync: true,
    get(key) {
      return storage.getItem(key);
    },
    set(key, value) {
      storage.setItem(key, value);
    },
    remove(key) {
      storage.removeItem(key);
    },
  };
}
