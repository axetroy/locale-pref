import { afterEach, describe, expect, it, vi } from 'vitest';
import { localStorageAdapter } from '../src/adapters/localStorage.js';
import { memoryAdapter } from '../src/adapters/memory.js';

class StorageMock implements Storage {
  private readonly map = new Map<string, string>();
  public setItemCalls = 0;
  public lastOptions: unknown;

  get length(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.map.delete(key);
  }

  setItem(key: string, value: string): void {
    this.setItemCalls += 1;
    this.map.set(key, value);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('localStorageAdapter', () => {
  it('throws at creation when no storage is available', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => localStorageAdapter()).toThrow('localStorage is not available in this environment');
  });

  it('exposes isSync', () => {
    expect(localStorageAdapter({ storage: new StorageMock() }).isSync).toBe(true);
  });

  it('round-trips a value', () => {
    const adapter = localStorageAdapter({ storage: new StorageMock() });
    adapter.set('user_locale', 'zh-CN');
    expect(adapter.get('user_locale')).toBe('zh-CN');
  });

  it('returns null for a missing key', () => {
    expect(localStorageAdapter({ storage: new StorageMock() }).get('user_locale')).toBe(null);
  });

  it('removes a value', () => {
    const storage = new StorageMock();
    const adapter = localStorageAdapter({ storage });
    adapter.set('user_locale', 'zh-CN');
    adapter.remove('user_locale');
    expect(adapter.get('user_locale')).toBe(null);
  });

  it('ignores StorageSetOptions on set', () => {
    const storage = new StorageMock();
    const adapter = localStorageAdapter({ storage });
    adapter.set('user_locale', 'zh-CN', { maxAge: 10, path: '/x', secure: true });
    expect(storage.setItemCalls).toBe(1);
    expect(adapter.get('user_locale')).toBe('zh-CN');
  });

  it('falls back to globalThis.localStorage when available', () => {
    const storage = new StorageMock();
    vi.stubGlobal('localStorage', storage);
    const adapter = localStorageAdapter();
    adapter.set('user_locale', 'fr-FR');
    expect(storage.getItem('user_locale')).toBe('fr-FR');
  });

  it('propagates storage errors', () => {
    const failing: Storage = {
      length: 0,
      clear: () => undefined,
      getItem: () => null,
      key: () => null,
      removeItem: () => undefined,
      setItem: () => {
        throw new DOMException('quota', 'QuotaExceededError');
      },
    };
    const adapter = localStorageAdapter({ storage: failing });
    expect(() => adapter.set('user_locale', 'en')).toThrow(DOMException);
  });
});

describe('memoryAdapter', () => {
  it('exposes isSync', () => {
    expect(memoryAdapter().isSync).toBe(true);
  });

  it('seeds values from the initial record', () => {
    expect(memoryAdapter({ user_locale: 'ja-JP' }).get('user_locale')).toBe('ja-JP');
  });

  it('round-trips and removes values', () => {
    const adapter = memoryAdapter();
    expect(adapter.get('k')).toBe(null);
    adapter.set('k', 'v');
    expect(adapter.get('k')).toBe('v');
    adapter.remove('k');
    expect(adapter.get('k')).toBe(null);
  });

  it('stores an empty string distinctly from a miss', () => {
    const adapter = memoryAdapter();
    adapter.set('k', '');
    expect(adapter.get('k')).toBe('');
  });
});
