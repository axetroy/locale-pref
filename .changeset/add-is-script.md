---
'locale-pref': minor
---

Add `isScript()` and its instance counterparts, so Simplified and Traditional
Chinese can be told apart.

Simplified and Traditional are the same language (`zh`) in two scripts, `Hans`
and `Hant` — a subtag, not a separate language — so `isLanguage` alone cannot
distinguish them.

- `isScript(locale, script)` (from `locale-pref/utils` and on the instance)
  tests the script subtag, maximizing the tag first so a region-only tag still
  resolves: `zh-CN` → `Hans`, `zh-TW`/`zh-HK`/`zh-MO` → `Hant`. Never throws for
  malformed or non-string input (returns `false`) and is case-insensitive.
- `isCurrentScript(script)` judges the resolved locale; `isCurrentScriptSync(script)`
  is its synchronous twin (requires an adapter with `isSync: true`).

Typical use: `isLanguage(locale, 'zh')` to detect Chinese, then
`isScript(locale, 'Hans')` to tell Simplified from Traditional.
