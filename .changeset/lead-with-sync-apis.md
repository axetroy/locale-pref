---
'locale-pref': patch
---

Lead the documentation with the synchronous API and give the asynchronous API
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
