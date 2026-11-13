---
'locale-pref': minor
---

Initial public release of `locale-pref`.

- `createLocalePref()` factory with a configurable locale fallback chain
  (`storage` → `fallback` sources → `defaultLocale`).
- Built-in adapters: `cookieAdapter` (browser read/write, Node.js read-only),
  `localStorageAdapter`, and `memoryAdapter`.
- Instance API: `getLocale`, `getLocaleSync`, `setLocale`, `clearLocale`,
  `isRegion`, `isCurrentRegion`, and `normalizeLocale`.
- Standalone tree-shakeable utilities exported from `locale-pref/utils`:
  `isRegion`, `normalizeLocale`, and `detectNavigatorLocale`.
- Zero runtime dependencies, pure ESM, browser and Node.js (SSR) support.
