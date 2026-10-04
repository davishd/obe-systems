# Configuration

| File | In git | Holds |
|---|---|---|
| `.env` | Committed | Non-secret settings |
| `.env.local` | Ignored | Secrets |

## Settings

| Variable | File | Purpose |
|---|---|---|
| `SCHWAB_API_BASE_URL` | `.env` | Schwab API root |
| `SCHWAB_CALLBACK_URL` | `.env` | OAuth callback |
| `SCHWAB_APP_KEY` | `.env.local` | Schwab app key |
| `SCHWAB_APP_SECRET` | `.env.local` | Schwab app secret |

A new setting goes in `.env.local` if it is a secret, otherwise in `.env`.
