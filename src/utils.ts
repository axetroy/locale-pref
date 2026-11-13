/**
 * Canonicalize a BCP 47 language tag.
 *
 * Returns the tag produced by `Intl.Locale.prototype.toString()`, or `null`
 * when the input is not a non-empty string or is not a structurally valid tag.
 *
 * @example
 * normalizeLocale('zh-hans-cn'); // 'zh-Hans-CN'
 * normalizeLocale('!!'); // null
 */
export function normalizeLocale(locale: string): string | null {
  if (typeof locale !== 'string' || locale.trim() === '') return null;
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
 * Never throws: non-string or malformed input yields `false`.
 *
 * @example
 * isRegion('zh-CN', 'cn'); // true (case-insensitive)
 * isRegion('zh', 'CN'); // false
 */
export function isRegion(locale: string, region: string): boolean {
  if (typeof locale !== 'string' || typeof region !== 'string') return false;
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
 */
export function detectNavigatorLocale(): string | null {
  const navigator = (globalThis as { navigator?: { languages?: unknown } }).navigator;
  const languages = navigator?.languages;
  if (!Array.isArray(languages)) return null;
  for (const language of languages) {
    if (typeof language !== 'string') continue;
    const normalized = normalizeLocale(language);
    if (normalized !== null) return normalized;
  }
  return null;
}
