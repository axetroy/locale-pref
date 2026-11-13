import type { StorageAdapter } from '../types.js';
import { getGlobal } from '../global.js';
import { webStorageAdapter } from './webStorage.js';

export interface SessionStorageAdapterOptions {
  /** Storage object to use. Defaults to `globalThis.sessionStorage`. */
  storage?: Storage;
}

/**
 * `sessionStorage`-backed adapter. Scoped to the current tab and cleared when
 * the tab closes, so it fits per-session overrides rather than a durable choice.
 * Throws at creation time when no storage object is supplied and the
 * environment has no `sessionStorage`.
 */
export function sessionStorageAdapter(options: SessionStorageAdapterOptions = {}): StorageAdapter {
  const storage = options.storage ?? getGlobal()?.sessionStorage;
  if (!storage) {
    throw new Error('sessionStorage is not available in this environment');
  }
  return webStorageAdapter(storage);
}
