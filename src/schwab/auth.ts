import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Config } from "../config.ts";
import { LoginRequiredError, networkFailure, SchwabError } from "./errors.ts";
import {
  loginExpiresAt,
  readTokens,
  type Tokens,
  writeTokens,
} from "./tokens.ts";

const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const tokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_in: z.number(),
});

const refreshResponseSchema = tokenResponseSchema.partial({
  refresh_token: true,
});

/** The app credentials and token file that authenticated requests need. */
export type Session = { config: Config; tokensPath: string };

/**
 * Builds the Schwab login URL with a new random `state`.
 *
 * @param config - Schwab settings and secrets.
 * @returns The authorize URL and the `state` it carries.
 * @throws SchwabError when the app key or secret is not set.
 */
export function createAuthorization(config: Config): {
  url: string;
  state: string;
} {
  if (!config.SCHWAB_APP_KEY || !config.SCHWAB_APP_SECRET) {
    throw new SchwabError(
      "Set SCHWAB_APP_KEY and SCHWAB_APP_SECRET in .env.local.",
    );
  }
  const state = randomUUID();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.SCHWAB_APP_KEY,
    redirect_uri: config.SCHWAB_CALLBACK_URL,
    state,
  });
  const endpoint = new URL("/v1/oauth/authorize", config.SCHWAB_API_BASE_URL);
  return { url: `${endpoint}?${params}`, state };
}

/**
 * Extracts the authorization code from the URL Schwab redirected the browser to.
 *
 * @param pasted - The redirected URL copied from the browser's address bar.
 * @param state - The `state` sent in the authorize URL.
 * @returns The authorization code.
 * @throws SchwabError when the text is not a URL, has no code, or carries another state.
 */
export function parseCallback(pasted: string, state: string): string {
  const url = URL.parse(pasted.trim());
  if (!url) throw new SchwabError("The pasted text is not a URL.");
  const code = url.searchParams.get("code");
  if (!code) throw new SchwabError("The pasted URL has no code.");
  if (url.searchParams.get("state") !== state) {
    throw new SchwabError("The pasted URL is from a different login attempt.");
  }
  return code;
}

/**
 * Trades an authorization code for tokens, starting a new 7-day login.
 *
 * @param config - Schwab settings and secrets.
 * @param code - Code returned by {@link parseCallback}.
 * @returns Tokens to save.
 * @throws LoginRequiredError when Schwab rejects the code.
 */
export async function exchangeCode(
  config: Config,
  code: string,
): Promise<Tokens> {
  const response = await requestTokens(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.SCHWAB_CALLBACK_URL,
  });
  if (!response.ok) {
    throw new LoginRequiredError(
      `Schwab rejected the login code: ${await describeResponse(response)}.`,
    );
  }
  const body = await parseTokenResponse(response, tokenResponseSchema);
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    accessExpiresAt: expiresAt(body.expires_in),
    refreshIssuedAt: new Date().toISOString(),
  };
}

/**
 * Returns an access token, refreshing and saving the tokens when the saved one is about to expire.
 *
 * @param session - App credentials and token file.
 * @returns An access token valid for more than five minutes.
 * @throws LoginRequiredError when there is no login, the 7-day login has ended, or Schwab rejects
 * the refresh token.
 */
export async function getAccessToken(session: Session): Promise<string> {
  const tokens = await readTokens(session.tokensPath);
  if (Date.parse(tokens.accessExpiresAt) - Date.now() > REFRESH_MARGIN_MS) {
    return tokens.accessToken;
  }
  if (Date.now() >= loginExpiresAt(tokens).getTime()) {
    throw new LoginRequiredError("The 7-day Schwab login has ended.");
  }
  const refreshed = await refreshTokens(session.config, tokens);
  await writeTokens(session.tokensPath, refreshed);
  return refreshed.accessToken;
}

async function refreshTokens(config: Config, tokens: Tokens): Promise<Tokens> {
  const response = await requestTokens(config, {
    grant_type: "refresh_token",
    refresh_token: tokens.refreshToken,
  });
  if (response.status === 400 || response.status === 401) {
    throw new LoginRequiredError(
      `Schwab rejected the refresh token: ${await describeResponse(response)}.`,
    );
  }
  if (!response.ok) {
    throw new SchwabError(
      `Schwab token refresh failed: ${await describeResponse(response)}`,
    );
  }
  const body = await parseTokenResponse(response, refreshResponseSchema);
  return {
    ...tokens,
    accessToken: body.access_token,
    refreshToken: body.refresh_token ?? tokens.refreshToken,
    accessExpiresAt: expiresAt(body.expires_in),
  };
}

function requestTokens(
  config: Config,
  params: Record<string, string>,
): Promise<Response> {
  const credentials = Buffer.from(
    `${config.SCHWAB_APP_KEY}:${config.SCHWAB_APP_SECRET}`,
  ).toString("base64");
  return fetch(new URL("/v1/oauth/token", config.SCHWAB_API_BASE_URL), {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
    body: new URLSearchParams(params),
  }).catch(networkFailure);
}

async function parseTokenResponse<T>(
  response: Response,
  schema: z.ZodType<T>,
): Promise<T> {
  const result = schema.safeParse(await response.json().catch(() => undefined));
  if (!result.success) {
    throw new SchwabError(
      `Unexpected token response from Schwab\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

async function describeResponse(response: Response): Promise<string> {
  return `${response.status} ${await response.text()}`.trim();
}

function expiresAt(expiresInSeconds: number): string {
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}
