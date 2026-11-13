import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectNavigatorLocale, isRegion, normalizeLocale } from '../src/utils.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isRegion', () => {
  it('detects a matching region subtag', () => {
    expect(isRegion('zh-CN', 'CN')).toBe(true);
  });

  it('detects a region inside a multi-subtag locale', () => {
    expect(isRegion('zh-Hans-CN', 'CN')).toBe(true);
  });

  it('is case-insensitive for both arguments', () => {
    expect(isRegion('zh-cn', 'cn')).toBe(true);
    expect(isRegion('ZH-HANS-CN', 'Cn')).toBe(true);
  });

  it('returns false when the tag has no region subtag', () => {
    expect(isRegion('zh', 'CN')).toBe(false);
  });

  it('returns false for a different region', () => {
    expect(isRegion('en-US', 'cn')).toBe(false);
  });

  it('returns false for an empty locale', () => {
    expect(isRegion('', 'CN')).toBe(false);
  });

  it('returns false for a malformed tag without throwing', () => {
    expect(isRegion('invalid_tag!!', 'CN')).toBe(false);
  });

  it('returns false for non-string input without throwing', () => {
    expect(isRegion(undefined as unknown as string, 'CN')).toBe(false);
    expect(isRegion('zh-CN', undefined as unknown as string)).toBe(false);
    expect(isRegion(null as unknown as string, null as unknown as string)).toBe(false);
  });
});

describe('normalizeLocale', () => {
  it('canonicalizes case and subtag order', () => {
    expect(normalizeLocale('zh-hans-cn')).toBe('zh-Hans-CN');
  });

  it('canonicalizes a script-only tag', () => {
    expect(normalizeLocale('zh-hant')).toBe('zh-Hant');
  });

  it('returns null for an empty string', () => {
    expect(normalizeLocale('')).toBe(null);
  });

  it('returns null for whitespace only', () => {
    expect(normalizeLocale('   ')).toBe(null);
  });

  it('returns null for a malformed tag', () => {
    expect(normalizeLocale('!!')).toBe(null);
  });

  it('returns null for non-string input', () => {
    expect(normalizeLocale(42 as unknown as string)).toBe(null);
  });
});

describe('detectNavigatorLocale', () => {
  it('returns the first valid entry of navigator.languages', () => {
    vi.stubGlobal('navigator', { languages: ['zh-CN', 'en-US'] });
    expect(detectNavigatorLocale()).toBe('zh-CN');
  });

  it('skips invalid entries', () => {
    vi.stubGlobal('navigator', { languages: ['!!', 'fr-FR'] });
    expect(detectNavigatorLocale()).toBe('fr-FR');
  });

  it('normalizes the selected entry', () => {
    vi.stubGlobal('navigator', { languages: ['zh-hans-cn'] });
    expect(detectNavigatorLocale()).toBe('zh-Hans-CN');
  });

  it('returns null when navigator is missing', () => {
    vi.stubGlobal('navigator', undefined);
    expect(detectNavigatorLocale()).toBe(null);
  });

  it('returns null when languages is not an array', () => {
    vi.stubGlobal('navigator', { languages: 'en-US' });
    expect(detectNavigatorLocale()).toBe(null);
  });

  it('returns null when languages is empty', () => {
    vi.stubGlobal('navigator', { languages: [] });
    expect(detectNavigatorLocale()).toBe(null);
  });

  it('ignores non-string entries', () => {
    vi.stubGlobal('navigator', { languages: [null, 5, 'de-DE'] });
    expect(detectNavigatorLocale()).toBe('de-DE');
  });

  it('does not read navigator.language', () => {
    vi.stubGlobal('navigator', { language: 'ja-JP' });
    expect(detectNavigatorLocale()).toBe(null);
  });
});
