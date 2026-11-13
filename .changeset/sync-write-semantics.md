---
'locale-pref': patch
---

Document that synchronous adapters already write synchronously, and lock the
behavior with tests.

`setLocale()` and `clearLocale()` return a `Promise`, but when the adapter is
synchronous the write completes before the call returns — `await` on a
non-thenable runs the adapter body inline — so `void pref.setLocale(x)` followed
by `pref.getLocaleSync()` already observes `x`. No `setLocaleSync()` /
`clearLocaleSync()` is added: it would not add capability, and returning a
`Promise` keeps write errors (quota, disabled storage, invalid tag) reachable
through one `.catch` / `try-catch` path for both sync and async adapters, while
also surfacing ignored failures as unhandled rejections instead of silent throws.

This is a documentation-and-tests change only; no runtime behavior changed.
