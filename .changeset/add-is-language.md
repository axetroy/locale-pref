---
'locale-pref': minor
---

Add `isLanguage()` to test a tag's primary language subtag.

- `isLanguage(locale, language)` is exported from `locale-pref/utils`. It tests
  whether a tag's primary language subtag matches a bare subtag such as `'zh'` or
  `'en'`, ignoring region and script — so `zh-Hans-CN` and `zh-Hant-TW` both match
  `'zh'`. It never throws for malformed or non-string input (returns `false`) and
  is case-insensitive.
- The instance gains `isLanguage(language)` / `isLanguageSync(language)`, which
  judge the current locale and delegate to the utility. `isLanguageSync` requires
  an adapter with `isSync: true`, like the other `*Sync` methods.

Previously only a region check existed; asking "is the current locale Chinese?"
required an awkward `isRegion` call or manual subtag parsing.
