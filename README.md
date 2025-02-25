# Sort monorepo

See our [CONTRIBUTING](./.github/CONTRIBUTING.md) guide.

## Dependency management

We use `pnpm` to manage this monorepo.

We use [syncpack](https://jamiemason.github.io/syncpack/) to keep dependency versions in sync across `packages` and `apps`.

```
pnpm exec syncpack list-mismatches
pnpm exec syncpack fix-mismatches
pnpm exec syncpack update
...
```
