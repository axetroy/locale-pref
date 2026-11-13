# locale-pref

**English** | [简体中文](./README.zh-CN.md)

Zero-dependency locale preference toolkit for JavaScript and TypeScript.

`locale-pref` answers three questions and nothing more:

1. **What language does the user want?** Read it from a pluggable storage backend
   with a configurable fallback chain.
2. **Remember the user's choice.** Persist a language tag to a cookie,
   `localStorage`, or your own backend.
3. **Is this language tag for a given region?** Match the region subtag of a BCP 47
   tag with `Intl.Locale`.

It is pure ESM, has no runtime dependencies, and works in browsers and Node.js
(including SSR).

**Reads and writes are synchronous by default.** Every built-in adapter
(`cookieAdapter`, `localStorageAdapter`, `sessionStorageAdapter`, `memoryAdapter`)
is synchronous, so the `*Sync` methods are the shortest path and need no `await`:

```ts
const pref = createLocalePref();
pref.setLocaleSync('zh-CN');
pref.getLocaleSync(); // 'zh-CN'
```

Asynchronous backends are a first-class case too. If your adapter returns
promises, use the `Promise`-returning methods and `await` them — see
[Working with an asynchronous backend](#working-with-an-asynchronous-backend).

## Installation

```sh
npm install locale-pref
# pnpm add locale-pref
# yarn add locale-pref
```

## Quick start

### Browser with cookies

```ts
import { createLocalePref } from 'locale-pref';

const pref = createLocalePref();

const locale = pref.getLocaleSync(); // e.g. 'zh-CN'
pref.setLocaleSync('en-US'); // writes a cookie, readable on the next request
```

The default adapter is `cookieAdapter()`, which is the right choice when the
server must know the locale while rendering. It is synchronous, so
`getLocaleSync()` / `setLocaleSync()` need no `await`.

### Browser with `localStorage`

```ts
import { createLocalePref, localStorageAdapter } from 'locale-pref';

const pref = createLocalePref({
  storage: localStorageAdapter(),
  storageKey: 'lang',
  fallback: ['navigator', 'en'],
  defaultLocale: 'en',
});

const locale = pref.getLocaleSync();
pref.setLocaleSync('fr-CA');
```

### Working with an asynchronous backend

When the locale lives behind an asynchronous API — Redis, IndexedDB, a `fetch`
call — implement the adapter with `Promise`-returning methods and omit `isSync`.
Use the `Promise`-returning methods and `await` them:

```ts
import { createLocalePref } from 'locale-pref';
import type { StorageAdapter } from 'locale-pref';

const storage: StorageAdapter = {
  async get(key) {
    return (await redis.get(key)) ?? null;
  },
  async set(key, value) {
    await redis.set(key, value);
  },
  async remove(key) {
    await redis.del(key);
  },
};

const pref = createLocalePref({ storage });

const locale = await pref.getLocale();
await pref.setLocale('fr-CA');
```

The `*Sync` methods throw with an asynchronous adapter, because there is nothing
to read or write synchronously. See
[How asynchronous adapters are handled](#how-asynchronous-adapters-are-handled).

### Server-side rendering (SSR)

On the server there is no `document` and no `navigator`, so pass the incoming
`Cookie` header to a read-only adapter. Resolve the locale, then render.

```ts
import { createLocalePref, cookieAdapter } from 'locale-pref';

// Express: `req.headers.cookie` holds the raw Cookie header.
export function resolveRequestLocale(cookieHeader: string | undefined): string {
  const pref = createLocalePref({
    storage: cookieAdapter({ cookieString: cookieHeader }),
    fallback: ['en'],
    defaultLocale: 'en',
  });
  return pref.getLocaleSync(); // synchronous, no await needed
}
```

To change the locale, write the cookie in your own response handler
(`Set-Cookie`) — the adapter is read-only on the server. See
[`cookieAdapter` is read-only in Node.js](#cookieadapter-is-read-only-in-nodejs).

## API reference

### `createLocalePref(options?): LocalePref`

Creates a locale preference instance. Every option has a default, so it can be
called with no arguments.

| Option              | Type                           | Default           | Description                                       |
| ------------------- | ------------------------------ | ----------------- | ------------------------------------------------- |
| `storage`           | `StorageAdapter`               | `cookieAdapter()` | Where the locale is stored.                       |
| `storageKey`        | `string`                       | `'user_locale'`   | Key used inside the storage backend.              |
| `fallback`          | `Array<'navigator' \| string>` | `['navigator']`   | Sources tried when storage misses.                |
| `defaultLocale`     | `string`                       | `'en'`            | Last-resort locale.                               |
| `storageSetOptions` | `StorageSetOptions`            | —                 | Defaults passed to `storage.set`.                 |
| `normalize`         | `boolean`                      | `true`            | Validate and canonicalize tags.                   |
| `onError`           | `(error, context) => void`     | silent            | Called when storage or `navigator` access throws. |

`'navigator'` inside `fallback` is reserved: it reads `navigator.languages`. Any
other string is treated as a fixed locale candidate. Invalid option values throw
a `TypeError` naming the offending field.

### `getDefaultLocalePref(): LocalePref`

Returns a lazily-created, process-wide instance equivalent to
`createLocalePref()` with no options (cookie storage, `'navigator'` fallback,
`'en'` default, `'user_locale'` key). It is created on the first call, so simply
importing the package has no side effects.

```ts
import { getDefaultLocalePref } from 'locale-pref';

const pref = getDefaultLocalePref(); // same instance on every call
pref.setLocaleSync('zh-CN');
```

Reach for it when the defaults fit and you want a single shared instance, for
example in a browser app that only reads and writes the locale cookie.

**Do not use it in a multi-tenant SSR server.** The instance lives for the whole
process and always reads the `'user_locale'` cookie, so a locale taken from one
request would leak into every other request. Create a per-request instance with
`createLocalePref({ storage: cookieAdapter({ cookieString }) })` there instead
(see [SSR](#server-side-rendering-ssr)). The same caution applies whenever two
parts of an app would otherwise fight over the same `'user_locale'` key.

### The `LocalePref` instance

Every read and write has a synchronous form and a `Promise`-returning form. The
synchronous methods come first below because they are the shortest path for the
built-in (synchronous) adapters.

```ts
interface LocalePref {
  // Synchronous — requires a synchronous adapter (all built-ins qualify).
  getLocaleSync(): string;
  setLocaleSync(locale: string): void;
  clearLocaleSync(): void;
  isCurrentRegionSync(region: string): boolean;

  // Asynchronous — for a promise-returning adapter, or one code path for both.
  getLocale(): Promise<string>;
  setLocale(locale: string): Promise<void>;
  clearLocale(): Promise<void>;
  isCurrentRegion(region: string): Promise<boolean>;

  // Independent of the adapter.
  isRegion(locale: string, region: string): boolean;
  normalizeLocale(locale: string): string | null;
  readonly storage: StorageAdapter;
}
```

#### `getLocaleSync(): string`

Returns the first valid tag found by walking the fallback chain:

1. `storage.get(storageKey)`, if non-empty and valid (or normalizable).
2. Each entry in `fallback`:
   - `'navigator'` reads `navigator.languages` and returns the first valid tag.
   - Any other string is returned if it is valid.
3. `defaultLocale`.

When `normalize` is `true`, every candidate is passed through `normalizeLocale`;
a `null` result counts as a miss and the chain continues. If the final
`defaultLocale` is invalid, `'en'` is returned. If the adapter's `get` throws,
the error is caught, reported to `onError` with `context === 'storage'`, and the
chain continues.

Only usable with a synchronous adapter. See
[limitations](#the-sync-methods-require-a-synchronous-adapter).

#### `setLocaleSync(locale: string): void`

Persists the locale. When `normalize` is `true`, the tag is canonicalized first
and an invalid tag throws a `RangeError`. Writes
`storage.set(storageKey, value, storageSetOptions)`. Returns nothing; a failure
throws, so wrap it in `try`/`catch` if a write can fail (quota, disabled
storage). Only usable with a synchronous adapter.

#### `clearLocaleSync(): void`

Removes the stored locale, so the next `getLocaleSync()` walks the fallback chain
again. Calls `storage.remove(storageKey, storageSetOptions)`: the write options
(for example a cookie `path`/`domain`) are forwarded, so a backend that scopes
entries by attribute deletes the right one. Only usable with a synchronous
adapter.

#### `isCurrentRegionSync(region: string): boolean`

Equivalent to `isRegion(getLocaleSync(), region)`. Only usable with a synchronous
adapter.

#### Asynchronous methods

The following four methods return a `Promise`. Use them with an adapter whose
methods return promises (an adapter that omits `isSync`, or sets it to `false`),
or when you want a single code path for both kinds of adapter.

#### `getLocale(): Promise<string>`

The asynchronous twin of `getLocaleSync`, with the same resolution logic.

#### `setLocale(locale: string): Promise<void>`

The asynchronous twin of `setLocaleSync`. Same validation and the same
`storage.set(...)` call; a failure rejects the returned promise instead of
throwing.

#### `clearLocale(): Promise<void>`

The asynchronous twin of `clearLocaleSync`.

#### `isCurrentRegion(region: string): Promise<boolean>`

Equivalent to `isRegion(await getLocale(), region)`.

#### `isRegion(locale: string, region: string): boolean`

Returns whether the language tag carries the given region subtag. Never throws:
invalid input returns `false`. Comparison is case-insensitive. This method is
synchronous for both kinds of adapter. See
[`isRegion` semantics](#isregion-semantics).

#### `normalizeLocale(locale: string): string | null`

Canonicalizes a tag (see [utilities](#utilities)). Returns `null` for invalid
input.

#### `storage`

The read-only adapter the instance was created with.

### Utilities

These are also exported from the `locale-pref/utils` subpath and can be imported
without pulling in the factory, which keeps bundles small:

```ts
import { detectNavigatorLocale, isRegion, normalizeLocale } from 'locale-pref/utils';
```

- **`normalizeLocale(locale)`** — returns the canonical BCP 47 tag via
  `Intl.Locale.prototype.toString()` (`'zh-hans-cn'` → `'zh-Hans-CN'`), or `null`
  for empty, whitespace-only, or malformed input.
- **`isRegion(locale, region)`** — see [below](#isregion-semantics).
- **`detectNavigatorLocale()`** — returns the first valid entry of
  `navigator.languages`, or `null` when `navigator` is absent, `languages` is not
  a non-empty array, or no entry is valid. It deliberately does not read
  `navigator.language`, which is the historical alias of `navigator.languages[0]`.

### `isRegion` semantics

`isRegion` tests whether the **language tag itself carries the region subtag**.
It does not infer where the user physically is, and it is not the same as the
region meaning of `Accept-Language`. Do not use it for location detection,
currency, or time zone decisions.

Tags without a region subtag return `false` for every region:

```ts
import { isRegion } from 'locale-pref';

isRegion('zh-CN', 'CN'); // true
isRegion('zh-Hans-CN', 'CN'); // true
isRegion('zh', 'CN'); // false — no region subtag
isRegion('en-US', 'CN'); // false
isRegion('en-US', 'us'); // true — case-insensitive
isRegion('not a tag!!', 'CN'); // false — never throws
```

### The `*Sync` methods require a synchronous adapter

`getLocaleSync`, `setLocaleSync`, `clearLocaleSync`, and `isCurrentRegionSync`
only work with an adapter that sets `isSync: true`. The built-in
`cookieAdapter`, `localStorageAdapter`, `sessionStorageAdapter`, and `memoryAdapter` all do. Calling a
`*Sync` method with an asynchronous adapter (one without `isSync`) throws:

```
Error: getLocaleSync() requires a synchronous storage adapter
Error: setLocaleSync() requires a synchronous storage adapter
```

The message names the method you called. If your adapter can be synchronous, set
`isSync: true`; otherwise use the `Promise`-returning methods and `await` them.

### Do synchronous adapters make writes synchronous?

Yes — and because several built-in adapters are synchronous, there are
synchronous twins so a synchronous flow can stay synchronous. `getLocaleSync()`
reads, `setLocaleSync()` and `clearLocaleSync()` write, and
`isCurrentRegionSync()` judges the current region:

```ts
const pref = createLocalePref({ storage: memoryAdapter() });

pref.setLocaleSync('zh-CN'); // returns void, throws on failure
pref.getLocaleSync(); // 'zh-CN'
pref.isCurrentRegionSync('CN'); // true
pref.clearLocaleSync();
```

**Why the twins exist.** A `Promise` return is wrong for a synchronous flow: a
floating `Promise` trips `@typescript-eslint/no-floating-promises` (part of
`recommendedTypeChecked`) unless you `await` it or silence it with `void` — even
though the write has already completed. And `await` is contagious: it turns the
enclosing function `async`, so a synchronous callback that calls `setLocale()`
cannot stay synchronous. The `*Sync` methods return `void`, so no `await` and no
`void` is needed, and an error is a normal `throw` you can catch with
`try`/`catch`.

Use `setLocale()` / `clearLocale()` with an asynchronous adapter, or when you
want a single code path for both kinds of adapter. Use the `*Sync` methods when
the adapter is synchronous and the surrounding code is too.

### `cookieAdapter` is read-only in Node.js

In the browser, `cookieAdapter` reads and writes `document.cookie`. On the
server, it reads the `cookieString` you provide and **throws** on write:

```
Error: cookieAdapter is read-only in Node.js environment
```

This is deliberate: cookies belong to the HTTP response, so the server must set
them itself. Use the resolved locale for rendering and emit `Set-Cookie` in your
framework.

## Storage adapters

### `cookieAdapter(options?)`

| Option          | Default    | Description                                       |
| --------------- | ---------- | ------------------------------------------------- |
| `cookieString`  | —          | Cookie header used for reads outside the browser. |
| `defaultPath`   | `'/'`      | Default cookie path.                              |
| `defaultMaxAge` | `31536000` | Default cookie lifetime in seconds (one year).    |

Writes `key=encodeURIComponent(value); path=…; max-age=…; SameSite=…` and adds
`Secure` only when `secure: true` is passed. A per-write `maxAge` overrides
`defaultMaxAge`. `remove` writes the same cookie (same `path`/`domain`) with
`max-age=0`, so it deletes the cookie it wrote; it ignores any `maxAge` in the
options. `isSync: true`.

### `localStorageAdapter(options?)`

Uses `globalThis.localStorage` by default. Throws at creation time if no storage
object is supplied and the environment has none. `set` ignores
`StorageSetOptions`. `isSync: true`.

### `sessionStorageAdapter(options?)`

Same shape as `localStorageAdapter`, backed by `globalThis.sessionStorage`
(or a `storage` you pass in). Throws at creation time when unavailable.
`isSync: true`.

`sessionStorage` is scoped to the current tab and cleared when the tab closes,
so it fits a per-session override that should not outlive the tab — but it is a
poor fit for the user's durable preference. The adapter is a plain synchronous
adapter: the fallback chain does not consult it for you, so choose the behavior
you want explicitly. A common pattern is a session override on top of a durable
cookie, which you express as a small custom adapter:

```ts
import { createLocalePref, cookieAdapter, sessionStorageAdapter, type StorageAdapter } from 'locale-pref';

const durable = cookieAdapter();
const session = sessionStorageAdapter();

// Session value wins; fall back to the durable cookie when the tab has none.
const storage: StorageAdapter = {
  isSync: true,
  get: (key) => session.get(key) ?? durable.get(key),
  set: (key, value, options) => {
    session.set(key, value);
    durable.set(key, value, options);
  },
  remove: (key, options) => {
    session.remove(key);
    durable.remove(key, options);
  },
};

const pref = createLocalePref({ storage, fallback: ['en'], defaultLocale: 'en' });
```

### `memoryAdapter(initial?)`

A `Map`-backed adapter for tests and short-lived Node processes. Seed it with
`memoryAdapter({ user_locale: 'zh-CN' })`. `isSync: true`.

### Writing a custom adapter

Implement `StorageAdapter`. Methods may be synchronous or asynchronous.

```ts
import { createLocalePref, type StorageAdapter } from 'locale-pref';

const redisAdapter: StorageAdapter = {
  async get(key) {
    return (await client.get(key)) ?? null;
  },
  async set(key, value) {
    await client.set(key, value);
  },
  async remove(key) {
    await client.del(key);
  },
};

const pref = createLocalePref({ storage: redisAdapter, storageKey: 'locale' });
```

For a synchronous backend (for example a cookie in a server framework), add
`isSync: true` to enable the `*Sync` methods (`getLocaleSync`, `setLocaleSync`,
`clearLocaleSync`, `isCurrentRegionSync`).

### How asynchronous adapters are handled

Async is a first-class case, not an afterthought. An adapter is asynchronous when
it omits `isSync` (or sets it to `false`) and its methods return promises.

| Call                    | Behavior with an async adapter                                                    |
| ----------------------- | --------------------------------------------------------------------------------- |
| `getLocale()`           | Awaits `storage.get`.                                                             |
| `setLocale()`           | Awaits `storage.set` before resolving.                                            |
| `clearLocale()`         | Awaits `storage.remove` before resolving.                                         |
| `isCurrentRegion()`     | Awaits the underlying `getLocale()`.                                              |
| `getLocaleSync()`       | **Throws** `Error: getLocaleSync() requires a synchronous storage adapter`.       |
| `setLocaleSync()`       | **Throws** `Error: setLocaleSync() requires a synchronous storage adapter`.       |
| `clearLocaleSync()`     | **Throws** `Error: clearLocaleSync() requires a synchronous storage adapter`.     |
| `isCurrentRegionSync()` | **Throws** `Error: isCurrentRegionSync() requires a synchronous storage adapter`. |

Four rules to rely on:

- **Rejections from `get` do not throw.** A rejected (or throwing) `storage.get`
  is reported to `onError` with context `'storage'` and the chain continues to
  the next fallback source, exactly like a sync adapter that throws.
- **Rejections from `set` / `remove` propagate.** A failed write or delete
  rejects the returned promise, so you can retry or surface it. The library does
  not swallow them.
- **The `*Sync` methods are unavailable.** There is no synchronous escape hatch
  for an async backend; use the `Promise`-returning methods and `await` them.
  Only set `isSync: true` when the methods genuinely return values synchronously.
  If you set it on an async adapter, `getLocaleSync()` reads a `Promise` where a
  `string` is expected and treats the stored value as a miss — it silently falls
  through to the fallback chain rather than returning the stored tag.
- **One adapter can serve both paths.** `setLocale()` and `setLocaleSync()` share
  validation and the `storage.set(...)` call; only the error channel differs
  (rejection vs. throw).

```ts
interface StorageAdapter {
  get(key: string): string | null | Promise<string | null>;
  set(key: string, value: string, options?: StorageSetOptions): void | Promise<void>;
  remove(key: string, options?: StorageSetOptions): void | Promise<void>;
  readonly isSync?: boolean;
}

interface StorageSetOptions {
  maxAge?: number;
  path?: string;
  sameSite?: 'Strict' | 'Lax' | 'None';
  secure?: boolean;
  domain?: string;
}
```

## Browser and runtime compatibility

`locale-pref` is pure ESM with no runtime dependencies. It needs exactly one
platform API: `Intl.Locale`.

| Runtime       | Supported                    |
| ------------- | ---------------------------- |
| Node.js       | 20.19.0 and later            |
| Chrome        | 74 and later                 |
| Firefox       | 75 and later                 |
| Safari        | 14 and later                 |
| Edge          | 79 and later                 |
| Module format | ESM only (no CommonJS build) |

CommonJS consumers can still load the package with a dynamic `import()`.

Every other API the library touches is far older than `Intl.Locale` and never
becomes the limiting factor: `navigator.languages` (Chrome 37 / Firefox 32 /
Safari 10.1), `Map` (Chrome 38), `Promise` (Chrome 32), `Object.entries`
(Chrome 54), and `document.cookie` / `localStorage` / `sessionStorage` (all
browsers). `globalThis`
(Chrome 71 / Firefox 65 / Safari 12.1) is resolved through a fallback chain
(`globalThis` → `self` → `window`), so its absence is not fatal either.

### Supporting older browsers with a polyfill

To support browsers below the versions above, add an `Intl.Locale` polyfill.
`locale-pref` deliberately does **not** bundle one: a polyfill is a runtime
dependency (breaking the zero-dependency guarantee), it is unnecessary for most
users, and it conflicts with `sideEffects: false`. Instead, load a polyfill in
your own application, before any `locale-pref` call:

```js
// Application entry, before importing locale-pref.
import '@formatjs/intl-locale/polyfill.js';
```

A few points to get right:

- **Use a real polyfill, not just a shim.** [`@formatjs/intl-locale`](https://formatjs.github.io/docs/polyfills/intl-locale)
  implements the full `Intl.Locale` surface and is what the examples here use.
  It is a polyfill/ponyfill, so importing it is safe even where the API exists.
- **Load it before `locale-pref` in every environment.** In SSR, import the
  polyfill in the server entry too; otherwise `getLocaleSync()` silently falls
  back to `defaultLocale` on the server.
- **Downlevel it to your browser target.** The published polyfill and the
  `locale-pref` build both target modern JavaScript. Run them through your
  bundler/Babel with your own `browserslist` so the syntax matches your
  supported browsers.
- **`Intl.Locale` is mandatory.** If it is missing at runtime, the library fails
  loudly rather than silently. See the next section.

### Missing `Intl.Locale` throws

`locale-pref` detects `Intl.Locale` and throws an actionable `Error` when it is
absent, instead of degrading to wrong answers:

```js
// Browser without Intl.Locale and without the polyfill:
isRegion('zh-CN', 'CN');
// Error: locale-pref requires Intl.Locale, ... Add a polyfill such as
// @formatjs/intl-locale ..., or pass { normalize: false } ...
```

Without this guard, `isRegion()` would return `false` and `normalizeLocale()`
would return `null` for every input, silently mis-routing users whose language
you meant to detect. The error message names the fix.

Affected entry points, with the default `normalize: true`:

| Call                                   | Without `Intl.Locale`    |
| -------------------------------------- | ------------------------ |
| `normalizeLocale()`                    | throws                   |
| `isRegion()` / `isCurrentRegionSync()` | throws                   |
| `getLocale()` / `getLocaleSync()`      | throws (normalizes tags) |
| `setLocale()`                          | rejects (normalizes tag) |
| `setLocaleSync()`                      | throws (normalizes tag)  |
| `clearLocale()` / `clearLocaleSync()`  | work                     |

The one escape hatch is `normalize: false`. The get/set methods then work without
`Intl.Locale` (they skip validation and canonicalization), but `isRegion()` /
`isCurrentRegion()` / `isCurrentRegionSync()` still require it.

## Development

```sh
pnpm install
pnpm run verify   # format, lint, typecheck, tests with coverage, build, package lint
pnpm run test     # run tests once
pnpm run test:watch
pnpm run build
```

The project uses [Changesets](https://github.com/changesets/changesets) for
versioning. Run `pnpm changeset` to describe a change; CI turns pending
changesets into a release pull request and publishes to npm with
[trusted publishing](https://docs.npmjs.com/trusted-publishers) when it merges.

## License

[MIT](./LICENSE)
