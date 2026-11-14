---
'locale-pref': minor
---

Add `isLanguage()` and its instance counterparts, the language-level counterpart
of `isRegion()`.

- `isLanguage(locale, language)` (from `locale-pref/utils` and re-exported on the
  instance) tests whether a tag's primary language subtag matches a bare subtag
  such as `'zh'` or `'en'`, ignoring region and script — so `zh-Hans-CN` and
  `zh-Hant-TW` both match `'zh'`. It never throws for malformed or non-string
  input (returns `false`) and is case-insensitive.
- `isLanguage(locale, language)` on the instance delegates to the utility.
- `isCurrentLanguage(language)` judges the resolved locale, the async twin of the
  region check.
- `isCurrentLanguageSync(language)` is its synchronous twin, requiring an adapter
  with `isSync: true` like the other `*Sync` methods.

Previously only a region check existed; asking "is the current locale Chinese?"
required an awkward `isRegion` call or manual subtag parsing.
