---
'locale-pref': patch
---

Fail loudly when `Intl.Locale` is unavailable, resolve the global object through a `globalThis` → `self` → `window` fallback chain, and document the browser-compatibility and polyfill story.
