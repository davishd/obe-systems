# Authentication

The CLI logs in to Schwab with OAuth and keeps the tokens in `tokens.json`. Commands that call
Schwab refresh the access token as needed.

## Commands

| Command | Does |
|---|---|
| `pnpm cli auth login` | Opens the Schwab login in the browser, reads the pasted redirect URL, and replaces `tokens.json` |
| `pnpm cli auth status` | Prints when the access token and the login expire |

After the Schwab login the browser shows a connection error. Copy the URL from its address bar.

## Token lifetimes

| Token | Lifetime | Renewal |
|---|---|---|
| Authorization code | About 30 seconds | Paste the redirect URL before it expires |
| Access token | 30 minutes | Refreshed when 5 minutes or less remain |
| Refresh token | 7 days from login | `pnpm cli auth login` |

## `tokens.json`

The file has mode `0600`, so only its owner can read or write it.

| Field | Holds |
|---|---|
| `accessToken` | Bearer token for API requests |
| `refreshToken` | Token that gets a new access token |
| `accessExpiresAt` | ISO time the access token expires |
| `refreshIssuedAt` | ISO time of the login |
