# AGENTS.md

Repository guidance for AI agents working in `locale-pref`.

## What this project is

`locale-pref` is a zero-runtime-dependency, ESM-only TypeScript library that
reads, persists, and matches BCP 47 language tags. The authoritative spec is
[`DESIGN.md`](./DESIGN.md); treat it as the source of truth for public API
behaviour, defaults, and error messages. `DESIGN.md` is intentionally excluded
from Prettier.

## Environment

- Node.js 20.19.0+ is the supported runtime floor. Development uses the latest
  LTS, pinned in `.nvmrc` (currently Node 26).
- pnpm only. The version is pinned in `package.json#packageManager`.
- `pnpm install --frozen-lockfile` is what CI runs; keep `pnpm-lock.yaml` in sync.
- The library and its tests run on Node 20.19+. The `changeset` CLI (dev-only,
  `@changesets/cli` v3) needs Node 22.11+, so use the pinned LTS for release work.

## Commands

```sh
pnpm install            # install dependencies
pnpm run verify         # the gate: format, lint, typecheck, coverage, build, deps, smoke, package lint
pnpm test               # vitest run (single pass)
pnpm run test:watch     # vitest in watch mode
pnpm run test:coverage  # vitest with v8 coverage
pnpm run build          # tsc -p tsconfig.build.json -> dist/
pnpm run lint:package   # publint + are-the-types-wrong
pnpm run format         # prettier --write
pnpm changeset          # add a changeset before committing a change
```

Run `pnpm run verify` before finishing any change. It must exit 0.

## Hard constraints

- Zero runtime dependencies. `scripts/check-zero-dependencies.mjs` fails CI if
  `dependencies`, `peerDependencies`, or `optionalDependencies` are non-empty.
- Pure ESM. There is no CommonJS build; `exports` maps only `import`/`default`.
- The `exports` map exposes `.` and `./utils`. `isRegion`, `normalizeLocale`,
  and `detectNavigatorLocale` live only on `locale-pref/utils`.
- Core logic must not touch `document` or `window` directly; environment access
  goes through the adapters in `src/adapters/`. The ambient global object is read
  only through `getGlobal()` in `src/global.ts`.
- `Intl.Locale` is a hard requirement. `normalizeLocale` / `isRegion` /
  `detectNavigatorLocale` must throw an actionable error when it is missing
  (never degrade to `null`/`false`). Invalid _input_ still returns `null`/`false`.
- `getDefaultLocalePref()` is a lazy process-wide singleton created on first
  call (never at module top level, to keep `sideEffects: false`). It must stay
  documented as unsafe for multi-tenant SSR; per-request `createLocalePref()` is
  the supported server pattern.
- Adapters are sync when `isSync === true`, otherwise async. `getLocale` /
  `setLocale` / `clearLocale` / `isCurrentRegion` must `await` adapter results so
  both work. A `get` rejection is reported to `onError` and falls through; `set`
  / `remove` rejections propagate. `localStorageAdapter` and
  `sessionStorageAdapter` share `webStorageAdapter()` in
  `src/adapters/webStorage.ts`.
- `setLocale*` and `clearLocale*` both forward `storageSetOptions` to the adapter
  (`storage.set(key, value, opts)` / `storage.remove(key, opts)`). A backend that
  scopes entries by attribute — notably a cookie's `path`/`domain` — needs the
  same options on delete as on write, or it deletes nothing. `cookieAdapter.remove`
  always writes `max-age=0` and ignores `maxAge` in the options.
- Writes and region checks have synchronous twins (`setLocaleSync`,
  `clearLocaleSync`, `isCurrentRegionSync`) alongside the `Promise`-returning
  methods, matching the existing `getLocaleSync`. Each `*Sync` method asserts
  `isSync === true` via `assertSyncAdapter()` and otherwise throws
  `"<method>() requires a synchronous storage adapter"`. They exist so a fully
  synchronous flow stays synchronous: a floating `Promise` would trip
  `@typescript-eslint/no-floating-promises` and `await` would force the caller
  `async`. Keep both paths behaviorally identical (shared `normalizeForWrite()` /
  `resolveLocaleSync()`), and do not drop the `Promise` variants — they are the
  only option for async adapters. See `test/sync-writes.test.ts` and `DESIGN.md`
  section 3.3.3.
- Coverage thresholds (see `vitest.config.ts`): lines/statements/functions 90,
  branches 85. The suite currently sits at 100%.
- Public API changes require a matching `README.md` update and a changeset.

## Layout

```
src/index.ts        createLocalePref / getDefaultLocalePref, re-exports
src/adapters/       cookie.ts, localStorage.ts, sessionStorage.ts, webStorage.ts, memory.ts
src/global.ts       getGlobal(): globalThis -> self -> window fallback
src/utils.ts        isRegion / normalizeLocale / detectNavigatorLocale
src/types.ts        public interfaces (excluded from coverage)
test/               Vitest suites, one file per source area
                    (getLocale / setLocale / sync-writes / utils / global /
                    default-instance / async-adapter / localStorage /
                    sessionStorage / cookie)
scripts/            CI helpers (dependency guard, entry-point smoke test)
```

## Conventions

- TypeScript strict mode with `noUncheckedIndexedAccess` and `verbatimModuleSyntax`.
  Use `import type` for type-only imports and `.js` extensions in relative
  specifiers (NodeNext resolution).
- Prettier: 120 columns, single quotes, trailing commas. Run `pnpm run format`.
- ESLint: `explicit-module-boundary-types` is on, so exported functions need
  explicit return types. `.mjs` scripts may use `console`.
- Tests use real implementations (including `memoryAdapter` and a small
  `document` mock). Do not introduce mocks for library code.
- Comments explain non-obvious intent only; do not narrate the change history.
- `assertOptions()` in `src/index.ts` is the single place for construction-time
  validation: it checks every option's type, requires `storage` to expose
  `get`/`set`/`remove`, requires `fallback` entries to be strings, and rejects
  empty `storageKey`/`defaultLocale`. Keep it in sync with `LocalePrefOptions`
  and with the DESIGN.md §3.1 list. `fallback` is copied on construction so
  caller mutation cannot change resolution order.

## Releasing

Changesets drive versioning. On push to `main`, `.github/workflows/release.yml`
either opens/updates the `chore(release): version packages` PR or publishes.
Publishing uses npm trusted publishing (OIDC); no `NPM_TOKEN` is required, but
the package's trusted publisher must be configured on npm.
