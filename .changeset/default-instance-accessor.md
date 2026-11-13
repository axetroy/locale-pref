---
'locale-pref': minor
---

Add `getDefaultLocalePref()`, a lazily-created process-wide instance equivalent to
`createLocalePref()` with no options. It is created on first call, so importing
the package stays side-effect free.

It is intended for browser apps whose defaults fit. It must not be used in a
multi-tenant SSR server: the instance is shared for the life of the process and
always reads the `'user_locale'` cookie, so a locale from one request would leak
into every other request. Create a per-request instance with `createLocalePref()`
there instead. The constraint is documented in the READMEs and `DESIGN.md`.
