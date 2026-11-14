import { getGlobal } from './global.js';

/**
 * Error raised when the runtime lacks `Intl.Locale`.
 *
 * Missing platform support is reported loudly instead of degrading silently:
 * without `Intl.Locale`, `normalizeLocale` and `isRegion` would otherwise
 * return `null`/`false` for every input and quietly produce wrong answers.
 */
const INTL_LOCALE_REQUIRED =
  'locale-pref requires Intl.Locale, which is unavailable in this runtime. ' +
  "Add a polyfill such as @formatjs/intl-locale (import '@formatjs/intl-locale/polyfill.js'), " +
  'or pass { normalize: false } to createLocalePref() to skip tag normalization.';

function assertIntlLocale(): void {
  if (typeof Intl === 'undefined' || typeof Intl.Locale !== 'function') {
    throw new Error(INTL_LOCALE_REQUIRED);
  }
}

/**
 * Canonicalize a BCP 47 language tag.
 *
 * Returns the tag produced by `Intl.Locale.prototype.toString()`, or `null`
 * when the input is not a non-empty string or is not a structurally valid tag.
 *
 * Throws when the runtime has no `Intl.Locale`; see {@link createLocalePref}.
 *
 * @example
 * normalizeLocale('zh-hans-cn'); // 'zh-Hans-CN'
 * normalizeLocale('!!'); // null
 */
export function normalizeLocale(locale: string): string | null {
  if (typeof locale !== 'string' || locale.trim() === '') return null;
  assertIntlLocale();
  try {
    return new Intl.Locale(locale).toString();
  } catch {
    return null;
  }
}

/**
 * Test whether a language tag carries a specific region subtag.
 *
 * This inspects the tag itself only. It does not infer the user's physical
 * location and is not equivalent to the region meaning of `Accept-Language`.
 * Tags without a region subtag (`en`, `zh`) are `false` for every region.
 *
 * Malformed or non-string input yields `false` and never throws. A runtime
 * without `Intl.Locale` throws instead; see {@link createLocalePref}.
 *
 * @example
 * isRegion('zh-CN', 'cn'); // true (case-insensitive)
 * isRegion('zh', 'CN'); // false
 */
export function isRegion(locale: string, region: string): boolean {
  if (typeof locale !== 'string' || typeof region !== 'string') return false;
  assertIntlLocale();
  try {
    const parsed = new Intl.Locale(locale);
    return parsed.region?.toUpperCase() === region.toUpperCase();
  } catch {
    return false;
  }
}

/**
 * Read the first structurally valid locale from `navigator.languages`.
 *
 * Returns `null` when `navigator` is missing, `navigator.languages` is not an
 * array, or no entry is a valid tag. `navigator.language` is intentionally not
 * consulted: it is the historical alias of `navigator.languages[0]`.
 *
 * Throws when the runtime has no `Intl.Locale`; see {@link createLocalePref}.
 */
export function detectNavigatorLocale(): string | null {
  const languages = getGlobal()?.navigator?.languages;
  if (!Array.isArray(languages)) return null;
  for (const language of languages) {
    if (typeof language !== 'string') continue;
    const normalized = normalizeLocale(language);
    if (normalized !== null) return normalized;
  }
  return null;
}

/**
 * Test whether a language tag carries a specific primary language subtag.
 *
 * This is the language-level counterpart of {@link isRegion}: it compares the
 * primary language subtag (`zh` in `zh-Hans-CN`) and ignores region, script, and
 * other extension subtags. The second argument is a bare language subtag
 * (`'zh'`, `'en'`), not a full tag.
 *
 * This inspects the tag itself only. It does not infer anything about the user,
 * and `zh-Hant-TW` and `zh-Hans-CN` are both `zh`.
 *
 * Malformed or non-string input yields `false` and never throws. A runtime
 * without `Intl.Locale` throws instead; see {@link createLocalePref}.
 *
 * @example
 * isLanguage('zh-Hans-CN', 'zh'); // true (case-insensitive)
 * isLanguage('zh-Hans-CN', 'ZH'); // true
 * isLanguage('en-US', 'zh'); // false
 * isLanguage('en', 'en'); // true
 */
export function isLanguage(locale: string, language: string): boolean {
  if (typeof locale !== 'string' || typeof language !== 'string') return false;
  assertIntlLocale();
  try {
    return new Intl.Locale(locale).language?.toLowerCase() === language.toLowerCase();
  } catch {
    return false;
  }
}
