---
'locale-pref': patch
---

Harden `createLocalePref()` option and `setLocale()` input validation.

- `createLocalePref()` now rejects a `storage` object that lacks `get`/`set`/`remove`
  (`{}` previously passed construction and failed later with an opaque error).
- `fallback` entries must be strings; a non-string entry is a `TypeError` instead of
  being silently ignored during resolution.
- `storageKey` and `defaultLocale` must be non-empty strings; an empty value used to
  make every read miss and every write a silent no-op.
- The `fallback` array is now copied at construction, so mutating the caller's array
  afterwards can no longer change the instance's resolution order.
- `setLocale()` / `setLocaleSync()` reject a non-string tag with a `TypeError` even
  when `normalize: false`, instead of passing a non-string through to the adapter.
