# Configuration

| File | In git | Holds |
|---|---|---|
| `.env` | Committed | Non-secret settings |
| `.env.local` | Ignored | Secrets |

## Settings

| Variable | File | Purpose |
|---|---|---|
| `SCHWAB_API_BASE_URL` | `.env` | Schwab API root |
| `SCHWAB_CALLBACK_URL` | `.env` | OAuth callback; must match the Schwab app registration exactly |
| `SCHWAB_APP_KEY` | `.env.local` | Schwab app key |
| `SCHWAB_APP_SECRET` | `.env.local` | Schwab app secret |

A new setting goes in `.env.local` if it is a secret, otherwise in `.env`. Add it to this table.

## Secret files

`.env.local` and `tokens.json` (Schwab OAuth tokens) are listed in `.gitignore` and denied to
Claude Code by `Read` rules in `.claude/settings.json`.
