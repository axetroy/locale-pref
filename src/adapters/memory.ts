import type { StorageAdapter } from '../types.js';

/**
 * In-memory adapter backed by a `Map`. Useful for tests and short-lived Node
 * processes where no persistent storage is available.
 *
 * @param initial - Optional seed values copied into the map.
 */
export function memoryAdapter(initial?: Record<string, string>): StorageAdapter {
  const store = new Map<string, string>(initial ? Object.entries(initial) : undefined);
  return {
    isSync: true,
    get(key) {
      return store.has(key) ? (store.get(key) as string) : null;
    },
    set(key, value) {
      store.set(key, value);
    },
    remove(key) {
      store.delete(key);
    },
  };
}
