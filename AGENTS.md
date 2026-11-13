# AGENTS.md

Repository guidance for AI agents working in `locale-pref`.

## What this project is

`locale-pref` is a zero-runtime-dependency, ESM-only TypeScript library that
reads, persists, and matches BCP 47 language tags. The authoritative spec is
[`DESIGN.md`](./DESIGN.md); treat it as the source of truth for public API
behaviour, defaults, and error messages. `DESIGN.md` is intentionally excluded
from Prettier.

## Environment

- Node.js 20.19.0+ (`.nvmrc` pins the development version).
- pnpm only. The version is pinned in `package.json#packageManager`.
- `pnpm install --frozen-lockfile` is what CI runs; keep `pnpm-lock.yaml` in sync.
- The library and its tests run on Node 20.19+. The `changeset` CLI (dev-only,
  `@changesets/cli` v3) needs Node 22.11+, so use Node 24 for release work.

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
  goes through the adapters in `src/adapters/`.
- Coverage thresholds (see `vitest.config.ts`): lines/statements/functions 90,
  branches 85. The suite currently sits at 100%.
- Public API changes require a matching `README.md` update and a changeset.

## Layout

```
src/index.ts        createLocalePref factory, re-exports
src/adapters/       cookie.ts, localStorage.ts, memory.ts
src/utils.ts        isRegion / normalizeLocale / detectNavigatorLocale
src/types.ts        public interfaces (excluded from coverage)
test/               Vitest suites, one file per source area
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

## Releasing

Changesets drive versioning. On push to `main`, `.github/workflows/release.yml`
either opens/updates the `chore(release): version packages` PR or publishes.
Publishing uses npm trusted publishing (OIDC); no `NPM_TOKEN` is required, but
the package's trusted publisher must be configured on npm.
