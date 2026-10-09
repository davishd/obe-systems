# Architecture

`src/cli/` is the command-line interface. Everything else in `src/` is core and works under any
interface.

## Modules

| Path | Holds | May import |
|---|---|---|
| `src/cli/` | Commands, prompts, browser opening, terminal formatting, exit codes, `tokens.json` path | Any core module |
| `src/config.ts` | Schwab settings validated from a given environment | Nothing in `src/` |
| `src/schwab/` | Schwab OAuth, token file, API requests, response schemas | `src/config.ts` |

## Rules

- Core never imports `src/cli/`, `commander`, `readline`, `child_process`, or `process`, and never
  uses `console` or the `process` global. `pnpm lint` checks this.
- Core returns data or throws `SchwabError`. The interface adds wording such as which command to
  run.
- A provider folder, such as `src/schwab/` or a future `src/massive/`, holds that provider's
  requests and response types.
- A capability folder, such as a future `src/backtest/`, takes provider data as input and never
  imports a provider folder. An interface command connects the two.
