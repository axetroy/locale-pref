import { describe, expect, it } from 'vitest';
import { getGlobal } from '../src/global.js';

const realGlobal = globalThis as Record<string, unknown>;
const KEYS = ['globalThis', 'self', 'window'] as const;

/**
 * Run `fn` with the given global identifiers hidden (set to `undefined`).
 *
 * `globalThis` must be restored before any assertion runs, because the test
 * runner itself depends on it.
 */
function withHiddenGlobals<T>(hidden: readonly (typeof KEYS)[number][], fn: () => T): T {
  const saved = KEYS.map((key) => [key, Object.getOwnPropertyDescriptor(realGlobal, key)] as const);
  try {
    for (const key of hidden) {
      Object.defineProperty(realGlobal, key, { value: undefined, configurable: true, writable: true });
    }
    return fn();
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(realGlobal, key, descriptor);
      else delete realGlobal[key];
    }
  }
}

describe('getGlobal', () => {
  it('returns globalThis when present', () => {
    expect(getGlobal()).toBe(globalThis);
  });

  it('falls back to self when globalThis is missing', () => {
    const selfValue = { marker: 'self' };
    Object.defineProperty(realGlobal, 'self', { value: selfValue, configurable: true, writable: true });
    const result = withHiddenGlobals(['globalThis'], () => getGlobal());
    delete realGlobal.self;
    expect(result).toBe(selfValue);
  });

  it('falls back to window when globalThis and self are missing', () => {
    const windowValue = { marker: 'window' };
    Object.defineProperty(realGlobal, 'window', { value: windowValue, configurable: true, writable: true });
    const result = withHiddenGlobals(['globalThis', 'self'], () => getGlobal());
    delete realGlobal.window;
    expect(result).toBe(windowValue);
  });

  it('returns undefined when no global object is available', () => {
    const result = withHiddenGlobals(['globalThis', 'self', 'window'], () => getGlobal());
    expect(result).toBeUndefined();
  });
});
