---
'locale-pref': minor
---

Add synchronous twins for the write and region methods: `setLocaleSync()`,
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
