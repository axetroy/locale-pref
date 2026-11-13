import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalePref, getDefaultLocalePref } from '../src/index.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getDefaultLocalePref', () => {
  it('returns a synchronous, cookie-backed instance', () => {
    expect(getDefaultLocalePref().storage.isSync).toBe(true);
  });

  it('caches a single process-wide instance', () => {
    expect(getDefaultLocalePref()).toBe(getDefaultLocalePref());
  });

  it('is distinct from a freshly created instance', () => {
    expect(getDefaultLocalePref()).not.toBe(createLocalePref());
  });

  it('uses the default fallback chain (navigator first)', async () => {
    vi.stubGlobal('navigator', { languages: ['fr-FR'] });
    await expect(getDefaultLocalePref().getLocale()).resolves.toBe('fr-FR');
  });

  it('falls back to en when no source matches', async () => {
    vi.stubGlobal('navigator', undefined);
    await expect(getDefaultLocalePref().getLocale()).resolves.toBe('en');
  });
});
