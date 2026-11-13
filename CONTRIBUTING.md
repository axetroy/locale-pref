# Contributing

Thanks for taking the time to contribute. This guide keeps the process short.

## Getting started

```sh
git clone https://github.com/axetroy/locale-pref.git
cd locale-pref
pnpm install
pnpm run verify
```

`pnpm run verify` runs formatting, linting, type-checking, tests with coverage,
the build, and package linting. Run it before opening a pull request.

## Requirements

- Node.js 20.19.0 or later (see `.nvmrc` for the development version).
- pnpm, pinned through the `packageManager` field in `package.json`.

## Project layout

```
src/
  index.ts          createLocalePref and adapter re-exports
  adapters/         cookie, localStorage, sessionStorage and memory backends
  utils.ts          isRegion / normalizeLocale / detectNavigatorLocale
  types.ts          public interfaces
test/               Vitest suites, one file per source area
scripts/            CI helpers (dependency guard, entry-point smoke test)
```

## Making a change

1. Create a branch off `main`.
2. Make the change and add or update tests. The suites are in `test/`.
3. Run `pnpm run verify`.
4. Add a changeset describing the change:

   ```sh
   pnpm changeset
   ```

   Pick `patch`, `minor`, or `major` and write a short summary.

5. Commit and open a pull request.

## Guidelines

- Keep the library free of runtime dependencies. `scripts/check-zero-dependencies.mjs`
  fails CI if a `dependencies`, `peerDependencies`, or `optionalDependencies`
  entry appears.
- Cover new behaviour with tests; coverage must stay at or above 90% for lines.
- Public API changes need a matching README update.
- Keep commits focused and write clear messages.

## Reporting bugs and requesting features

Open an issue at <https://github.com/axetroy/locale-pref/issues>. Include a
minimal reproduction for bugs.

## License

By contributing, you agree that your contributions are licensed under the
[MIT License](./LICENSE).
