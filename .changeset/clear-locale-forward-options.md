---
'locale-pref': patch
---

Forward the write options to `storage.remove`, and always expire cookie deletions.

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
