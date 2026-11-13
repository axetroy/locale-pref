import type { StorageAdapter } from '../types.js';
import { getGlobal } from '../global.js';
import { webStorageAdapter } from './webStorage.js';

export interface LocalStorageAdapterOptions {
  /** Storage object to use. Defaults to `globalThis.localStorage`. */
  storage?: Storage;
}

/**
 * `localStorage`-backed adapter. Throws at creation time when no storage object
 * is supplied and the environment has no `localStorage`, so the failure is
 * obvious rather than deferred to the first read.
 */
export function localStorageAdapter(options: LocalStorageAdapterOptions = {}): StorageAdapter {
  const storage = options.storage ?? getGlobal()?.localStorage;
  if (!storage) {
    throw new Error('localStorage is not available in this environment');
  }
  return webStorageAdapter(storage);
}
