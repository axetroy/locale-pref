# Changelog

## 0.1.0

### Minor Changes

- cd2abd9: Add `getDefaultLocalePref()`, a lazily-created process-wide instance equivalent to
  `createLocalePref()` with no options. It is created on first call, so importing
  the package stays side-effect free.
  
  It is intended for browser apps whose defaults fit. It must not be used in a
  multi-tenant SSR server: the instance is shared for the life of the process and
  always reads the `'user_locale'` cookie, so a locale from one request would leak
  into every other request. Create a per-request instance with `createLocalePref()`
  there instead. The constraint is documented in the READMEs and `DESIGN.md`.
- cd2abd9: Initial public release of `locale-pref`.
  
  - `createLocalePref()` factory with a configurable locale fallback chain
    (`storage` → `fallback` sources → `defaultLocale`).
  - Built-in adapters: `cookieAdapter` (browser read/write, Node.js read-only),
    `localStorageAdapter`, and `memoryAdapter`.
  - Instance API: `getLocale`, `getLocaleSync`, `setLocale`, `clearLocale`,
    `isRegion`, `isCurrentRegion`, and `normalizeLocale`.
  - Standalone tree-shakeable utilities exported from `locale-pref/utils`:
    `isRegion`, `normalizeLocale`, and `detectNavigatorLocale`.
  - Zero runtime dependencies, pure ESM, browser and Node.js (SSR) support.
- cd2abd9: Add `sessionStorageAdapter()` for per-tab, session-scoped locale overrides. It
  mirrors `localStorageAdapter()` (throws at creation when unavailable, `isSync:
  true`) and shares an internal `webStorageAdapter()` helper with it.
  
  `sessionStorage` is cleared when the tab closes, so it is not a durable
  preference on its own; the README shows how to combine it with a durable cookie
  when you want a session override that falls back to a saved choice.
  
  Also document how asynchronous adapters behave, and cover it with tests:
  `getLocale` / `setLocale` / `clearLocale` / `isCurrentRegion` await adapter
  results; a rejected `get` is reported to `onError` and falls through to the
  fallback chain, while rejected `set` / `remove` calls propagate to the caller;
  `getLocaleSync()` throws for an adapter without `isSync: true`.
- 6c1e5e2: Add synchronous twins for the write and region methods: `setLocaleSync()`,
  `clearLocaleSync()`, and `isCurrentRegionSync()`. They match the existing
  `getLocaleSync()` and require a synchronous adapter (`isSync: true`), throwing
  `"<method>() requires a synchronous storage adapter"` otherwise.
  
  They exist so a fully synchronous flow can stay synchronous. Calling
  `setLocale()` from such a flow returns a `Promise<void>`, which
  `@typescript-eslint/no-floating-promises` (and similar typed-lint setups)
  rejects unless you `await` it or silence it with `void` — even though the write
  has already completed — and `await` would force the enclosing function `async`.
  The `*Sync` methods return `void`, so no `await` or `void` is needed and a
  failure is a plain `throw` you can catch with `try`/`catch`.
  
  The `Promise`-returning methods remain the default and the only option with an
  asynchronous adapter; both paths share the same validation and storage calls, so
  they behave identically.

### Patch Changes

- cd2abd9: Fail loudly when `Intl.Locale` is unavailable, resolve the global object through a `globalThis` → `self` → `window` fallback chain, and document the browser-compatibility and polyfill story.
- cd2abd9: Add a Simplified Chinese README (`README.zh-CN.md`) with language links between
  the English and Chinese docs.
- df090ef: Forward the write options to `storage.remove`, and always expire cookie deletions.
  
  - `clearLocale()` / `clearLocaleSync()` now call
    `storage.remove(storageKey, storageSetOptions)` instead of
    `storage.remove(storageKey)`. Previously a cookie written with a custom `path`
    or `domain` was never deleted, because the tombstone was written to the default
    `path=/` while the value lived at another path. `StorageAdapter.remove` accepts
    an optional `StorageSetOptions` argument for this.
  - `cookieAdapter().remove()` now always writes `max-age=0`. It previously reused
    `setOptions.maxAge`, so a deletion that carried a `maxAge` (for example through
    `storageSetOptions`) wrote a non-zero lifetime and re-created the cookie rather
    than deleting it.
  - `cookieAdapter().set()` honours a per-write `maxAge` over `defaultMaxAge`.
- 5dc0d93: Lead the documentation with the synchronous API and give the asynchronous API
  its own section.
  
  Every built-in adapter (`cookieAdapter`, `localStorageAdapter`,
  `sessionStorageAdapter`, `memoryAdapter`) is synchronous, so the README now opens
  with `getLocaleSync()` / `setLocaleSync()`, shows them first in the quick start,
  and lists the instance methods with the `*Sync` forms before the
  `Promise`-returning ones. The `Promise` methods are grouped under an
  "Asynchronous methods" subsection with their own quick-start example for
  promise-returning backends (Redis, IndexedDB, `fetch`), and the async-adapter
  table now covers all four `*Sync` methods.
  
  Documentation only; no runtime behavior changed.
