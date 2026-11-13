# Changesets

This folder holds the [Changesets](https://github.com/changesets/changesets) that
describe pending releases. Each Markdown file names the bump type and a short
summary. The release workflow consumes them, updates `CHANGELOG.md`, bumps the
version in `package.json`, and publishes to npm with provenance.

## Adding a changeset

```sh
pnpm changeset
```

Pick the bump (`patch`, `minor`, `major`), write a summary, and commit the new
file with your change. The `Version Packages` pull request is opened and kept up
to date automatically by the release workflow.

## Bump guidelines

| Change                                    | Bump    |
| ----------------------------------------- | ------- |
| Bug fix, documentation, internal refactor | `patch` |
| New backwards-compatible API              | `minor` |
| Breaking change to a public API           | `major` |

See [`.changeset/README.md`](https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md)
for the full guide.
