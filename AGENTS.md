# AGENTS.md

Guidance for AI coding agents working in this repository.

## Repository conventions

- `docs/` is public and committed: documentation on parts of the application. Work that
  establishes a convention or component documents it there. Reference only: no tutorials or
  rationale.
- `docs-local/` is gitignored and holds personal notes and brainstorms. Read them for context when
  pointed to them, but never cite or link them from committed files or Linear issues.
- The app is general-use. Global names and descriptions never tie it to one strategy; strategy
  wording stays in the command or module that implements it.

## Architecture

- Code outside `src/cli/` is core. It returns data or throws typed errors, and never prints,
  prompts, reads `process.env`, or names a CLI command. `pnpm lint` enforces this.
- Each capability, such as Schwab access or backtesting, has its own folder under `src/`.
  `docs/architecture.md` lists them and their allowed imports.
- Provider folders such as `src/schwab/` hold that provider's API details. Other capabilities take
  the data they need as input instead of importing a provider. Add a shared contract only when a
  second provider or consumer needs one.

## Code style

- Avoid nested calls; assign a call's result to a named variable before passing it on. Nest only
  where naming the value adds nothing.

## Workflow

- Work is tracked in Linear, team "OBE Systems" (identifiers like `OBE-2`). An issue may take
  many commits on its branch; they are squashed when merged into `develop`.
- An issue's description is the starting plan, not a contract; the approach may change during
  implementation.
- Branch names are `<type>/<identifier>-<slug>`, e.g.
  `feature/obe-2-set-up-env-files-for-schwab-config-and-secrets`.
- Branch types:
  | Prefix | Use for |
  |---|---|
  | `feature/` | New behavior or capability |
  | `fix/` | Fixing a defect |
  | `chore/` | Maintenance with no behavior change: dependencies, config, tooling |
  | `docs/` | Documentation only |
  | `spike/` | Time-boxed exploration; usually not merged |

## Comments

Exported functions, classes, and types get a doc comment in the language's standard format (TSDoc
for TypeScript, docstrings for Python): a one-line description, each parameter, and the return
value. Do not repeat types the signature already declares.

Inline comments default to none. One earns its place only by explaining why, where the code cannot
show it.

- One or two lines. Never restate what the code says.
- No ticket numbers, dates, or history; those go in the commit message.
- No speculative future notes and no tutorials; explain today's code.
- Most functions need no comment. Comments on several branches of one function mean the code is
  being narrated.

These rules cover every file, including config such as `.gitignore` and `.env`.

## Commit messages

- Subject: imperative verb first, no trailing period, at most 72 characters.
- Body: wrapped at 72. Each sentence starts with a verb and states what changed. No connecting
  prose ("Also", "This commit").
- Last line: the Linear identifier.
