---
'locale-pref': minor
---

Add `isScript()` to tell Simplified from Traditional Chinese.

Simplified and Traditional are the same language (`zh`) in two scripts, `Hans`
and `Hant` — a subtag, not a separate language — so `isLanguage` alone cannot
distinguish them.

- `isScript(locale, script)` is exported from `locale-pref/utils`. It tests the
  script subtag, maximizing the tag first so a region-only tag still resolves:
  `zh-CN` → `Hans`, `zh-TW`/`zh-HK`/`zh-MO` → `Hant`. Never throws for malformed
  or non-string input (returns `false`) and is case-insensitive.
- The instance gains `isScript(script)` / `isScriptSync(script)`, which judge the
  current locale and delegate to the utility.

Typical use: `isLanguage(locale, 'zh')` to detect Chinese, then
`isScript(locale, 'Hans')` to tell Simplified from Traditional.
