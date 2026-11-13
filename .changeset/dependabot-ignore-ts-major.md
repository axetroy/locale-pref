---
---

Stop Dependabot from proposing a TypeScript major bump. `typescript-eslint`
8.72.2 caps the supported range at `>=4.8.4 <6.1.0` and hard-errors on
TypeScript 7, which fails the lint step; the existing PR #2 is that bump. CI
config only, so no version bump.
