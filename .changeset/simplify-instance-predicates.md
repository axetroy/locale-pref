---
'locale-pref': minor
---

Simplify the instance predicates: the instance answers only about the current
locale, and the pure predicates live only on `locale-pref/utils`.

**Breaking** (0.x minor, as pre-1.0 breaking changes bump the minor):

- `isCurrentRegion(region)` → `isRegion(region)`, and
  `isCurrentRegionSync(region)` → `isRegionSync(region)`. The `Current` prefix is
  gone because on the instance "current" is already the default, exactly as with
  `getLocale()`.
- The instance no longer exposes the pure `isRegion(locale, region)` /
  `isLanguage(locale, language)` / `isScript(locale, script)` forms, nor
  `normalizeLocale(locale)`. Import them from `locale-pref/utils` instead; the
  instance methods delegate to them.

Why: the pure predicates were duplicated on the instance, and overloading the
instance form on argument count would make `pref.isRegion('zh-CN')` silently mean
"is the *current* locale's region `zh-CN`?", switching the return type between
`boolean` and `Promise<boolean>` by arity. Keeping them apart gives each question
exactly one spelling:

```ts
import { createLocalePref } from 'locale-pref';
import { isRegion } from 'locale-pref/utils';

const pref = createLocalePref();

await pref.isRegion('CN');     // about the current locale (reads storage)
isRegion('zh-Hans-CN', 'CN');  // about any tag you have (pure, no storage)
```
