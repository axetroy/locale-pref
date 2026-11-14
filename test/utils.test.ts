import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectNavigatorLocale, isLanguage, isRegion, isScript, normalizeLocale } from '../src/utils.js';

afterEach(() => {
  vi.unstubAllGlobals();
});

const realGlobal = globalThis as Record<string, unknown>;

/** Run `fn` with `globalThis` hidden, restoring it before returning. */
function withoutGlobalThis<T>(fn: () => T): T {
  const descriptor = Object.getOwnPropertyDescriptor(realGlobal, 'globalThis');
  try {
    Object.defineProperty(realGlobal, 'globalThis', { value: undefined, configurable: true, writable: true });
    return fn();
  } finally {
    if (descriptor) Object.defineProperty(realGlobal, 'globalThis', descriptor);
  }
}

describe('Intl.Locale requirement', () => {
  const withIntlLocale = (value: unknown, fn: () => void): void => {
    const descriptor = Object.getOwnPropertyDescriptor(Intl, 'Locale');
    try {
      Object.defineProperty(Intl, 'Locale', { value, configurable: true, writable: true });
      fn();
    } finally {
      if (descriptor) Object.defineProperty(Intl, 'Locale', descriptor);
      else delete (Intl as { Locale?: unknown }).Locale;
    }
  };

  it('normalizeLocale throws an actionable error when Intl.Locale is missing', () => {
    withIntlLocale(undefined, () => {
      expect(() => normalizeLocale('zh-CN')).toThrow(/Intl\.Locale/);
    });
  });

  it('isRegion throws an actionable error when Intl.Locale is missing', () => {
    withIntlLocale(undefined, () => {
      expect(() => isRegion('zh-CN', 'CN')).toThrow(/@formatjs\/intl-locale/);
    });
  });

  it('isLanguage throws an actionable error when Intl.Locale is missing', () => {
    withIntlLocale(undefined, () => {
      expect(() => isLanguage('zh-CN', 'zh')).toThrow(/@formatjs\/intl-locale/);
    });
  });

  it('isLanguage still returns false for non-string input without Intl.Locale', () => {
    withIntlLocale(undefined, () => {
      expect(isLanguage(undefined as unknown as string, 'zh')).toBe(false);
    });
  });

  it('isScript throws an actionable error when Intl.Locale is missing', () => {
    withIntlLocale(undefined, () => {
      expect(() => isScript('zh-CN', 'Hans')).toThrow(/@formatjs\/intl-locale/);
    });
  });

  it('isScript still returns false for non-string input without Intl.Locale', () => {
    withIntlLocale(undefined, () => {
      expect(isScript(undefined as unknown as string, 'Hans')).toBe(false);
    });
  });

  it('still returns false for non-string input without Intl.Locale', () => {
    withIntlLocale(undefined, () => {
      expect(isRegion(undefined as unknown as string, 'CN')).toBe(false);
    });
  });

  it('still returns null for an empty string without Intl.Locale', () => {
    withIntlLocale(undefined, () => {
      expect(normalizeLocale('')).toBe(null);
    });
  });
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

describe('isLanguage', () => {
  it('detects a matching primary language subtag', () => {
    expect(isLanguage('zh-CN', 'zh')).toBe(true);
    expect(isLanguage('en', 'en')).toBe(true);
  });

  it('ignores region and script subtags', () => {
    expect(isLanguage('zh-Hans-CN', 'zh')).toBe(true);
    expect(isLanguage('zh-Hant-TW', 'zh')).toBe(true);
  });

  it('is case-insensitive for both arguments', () => {
    expect(isLanguage('ZH-HANS-CN', 'Zh')).toBe(true);
    expect(isLanguage('zh-CN', 'ZH')).toBe(true);
  });

  it('returns false for a different language', () => {
    expect(isLanguage('en-US', 'zh')).toBe(false);
    expect(isLanguage('zh-CN', 'en')).toBe(false);
  });

  it('returns false for an empty or malformed tag without throwing', () => {
    expect(isLanguage('', 'zh')).toBe(false);
    expect(isLanguage('invalid_tag!!', 'zh')).toBe(false);
  });

  it('returns false for a bare region-like argument that is not a language', () => {
    expect(isLanguage('en-US', 'US')).toBe(false);
  });

  it('returns false for non-string input without throwing', () => {
    expect(isLanguage(undefined as unknown as string, 'zh')).toBe(false);
    expect(isLanguage('zh-CN', undefined as unknown as string)).toBe(false);
    expect(isLanguage(null as unknown as string, null as unknown as string)).toBe(false);
  });
});

describe('isScript', () => {
  it('detects an explicit script subtag', () => {
    expect(isScript('zh-Hans-CN', 'Hans')).toBe(true);
    expect(isScript('zh-Hant-TW', 'Hant')).toBe(true);
    expect(isScript('sr-Latn-RS', 'Latn')).toBe(true);
    expect(isScript('sr-Cyrl', 'Cyrl')).toBe(true);
  });

  it('resolves a region-only tag to its likely script', () => {
    expect(isScript('zh-CN', 'Hans')).toBe(true);
    expect(isScript('zh-SG', 'Hans')).toBe(true);
    expect(isScript('zh-TW', 'Hant')).toBe(true);
    expect(isScript('zh-HK', 'Hant')).toBe(true);
    expect(isScript('zh-MO', 'Hant')).toBe(true);
  });

  it('distinguishes Simplified from Traditional', () => {
    expect(isScript('zh-CN', 'Hant')).toBe(false);
    expect(isScript('zh-TW', 'Hans')).toBe(false);
    expect(isScript('zh-Hans', 'Hant')).toBe(false);
    expect(isScript('zh-Hant', 'Hans')).toBe(false);
  });

  it('is case-insensitive for both arguments', () => {
    expect(isScript('zh-cn', 'hans')).toBe(true);
    expect(isScript('ZH-TW', 'HANT')).toBe(true);
  });

  it('returns false for a language with a different script', () => {
    expect(isScript('en-US', 'Hant')).toBe(false);
    expect(isScript('en-US', 'Latn')).toBe(true);
  });

  it('returns false for an empty or malformed tag without throwing', () => {
    expect(isScript('', 'Hans')).toBe(false);
    expect(isScript('invalid_tag!!', 'Hans')).toBe(false);
  });

  it('returns false for a language-like argument that is not a script', () => {
    expect(isScript('zh-CN', 'zh')).toBe(false);
  });

  it('returns false for non-string input without throwing', () => {
    expect(isScript(undefined as unknown as string, 'Hans')).toBe(false);
    expect(isScript('zh-CN', undefined as unknown as string)).toBe(false);
    expect(isScript(null as unknown as string, null as unknown as string)).toBe(false);
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

  it('reads navigator via self when globalThis is missing', () => {
    Object.defineProperty(realGlobal, 'self', {
      value: { navigator: { languages: ['fr-FR'] } },
      configurable: true,
      writable: true,
    });
    const result = withoutGlobalThis(() => detectNavigatorLocale());
    delete realGlobal.self;
    expect(result).toBe('fr-FR');
  });

  it('returns null when no global object is available', () => {
    const result = withoutGlobalThis(() => detectNavigatorLocale());
    expect(result).toBe(null);
  });
});
