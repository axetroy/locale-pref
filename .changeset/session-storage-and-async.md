---
'locale-pref': minor
---

Add `sessionStorageAdapter()` for per-tab, session-scoped locale overrides. It
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
