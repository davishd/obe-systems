# Development

Requires Node 22 or later and pnpm. `pnpm install` installs dependencies.

## Scripts

| Script | Runs | Purpose |
|---|---|---|
| `pnpm cli` | `tsx src/cli/index.ts` with `.env` and `.env.local` loaded | Run the CLI; `pnpm cli --help` lists commands |
| `pnpm test` | `vitest run` | Run the test suite |
| `pnpm typecheck` | `tsc` | Check types |
| `pnpm lint` | `biome check .` | Report lint, formatting, and import-order problems |
| `pnpm format` | `biome check --write .` | Fix what `lint` reports where a safe fix exists |

## Tooling files

| File | Configures |
|---|---|
| `package.json` | Scripts, dependencies, Node version |
| `pnpm-lock.yaml` | Exact dependency versions; never edited by hand |
| `pnpm-workspace.yaml` | Which dependencies may run install scripts |
| `tsconfig.json` | Type checking |
| `biome.json` | Linting and formatting |

Dependency install scripts are denied by default. A new dependency that has one fails
`pnpm install` until it is listed under `allowBuilds` in `pnpm-workspace.yaml`.
