import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Config } from "../config.ts";
import {
  completeLogin,
  createAuthorization,
  exchangeCode,
  getAccessToken,
  getLoginStatus,
  parseCallback,
  type Session,
} from "./auth.ts";
import { LoginRequiredError, SchwabError } from "./errors.ts";
import { readTokens, type Tokens, writeTokens } from "./tokens.ts";

const config: Config = {
  SCHWAB_API_BASE_URL: "https://api.schwabapi.com",
  SCHWAB_CALLBACK_URL: "https://127.0.0.1:3000",
  SCHWAB_APP_KEY: "key",
  SCHWAB_APP_SECRET: "secret",
};

const NOW = new Date("2026-10-02T12:00:00.000Z");

const tokenResponse = {
  access_token: "access-1",
  refresh_token: "refresh-1",
  expires_in: 1800,
  token_type: "Bearer",
  scope: "api",
  id_token: "jwt",
};

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn<typeof fetch>(async () =>
    Response.json(body, { status }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sentRequest(fetchMock: ReturnType<typeof stubFetch>) {
  const [url, init] = fetchMock.mock.calls[0] ?? [];
  return {
    url: String(url),
    method: init?.method,
    headers: init?.headers,
    body: Object.fromEntries(init?.body as URLSearchParams),
  };
}

beforeEach(() => {
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("createAuthorization", () => {
  it("builds the authorize URL with the app key and the callback URL exactly as configured", () => {
    const url = new URL(createAuthorization(config).url);
    expect(`${url.origin}${url.pathname}`).toBe(
      "https://api.schwabapi.com/v1/oauth/authorize",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("key");
    expect(url.searchParams.get("redirect_uri")).toBe("https://127.0.0.1:3000");
  });

  it("carries the returned state in the URL", () => {
    const { url, state } = createAuthorization(config);
    expect(new URL(url).searchParams.get("state")).toBe(state);
  });

  it("creates a new state on each call", () => {
    expect(createAuthorization(config).state).not.toBe(
      createAuthorization(config).state,
    );
  });

  it.each(["SCHWAB_APP_KEY", "SCHWAB_APP_SECRET"])(
    "throws SchwabError when %s is empty",
    (name) => {
      expect(() => createAuthorization({ ...config, [name]: "" })).toThrow(
        SchwabError,
      );
    },
  );
});

describe("parseCallback", () => {
  it("returns the code decoded exactly once", () => {
    const callbackUrl =
      "https://127.0.0.1:3000/?code=C0.abc%40&session=xyz&state=s1";
    expect(parseCallback(callbackUrl, "s1")).toBe("C0.abc@");
  });

  it("ignores whitespace around the callback URL", () => {
    expect(
      parseCallback("  https://127.0.0.1:3000/?code=abc&state=s1\n", "s1"),
    ).toBe("abc");
  });

  it.each([
    ["the text is not a URL", "code=abc&state=s1"],
    ["the code is missing", "https://127.0.0.1:3000/?state=s1"],
    ["the state is missing", "https://127.0.0.1:3000/?code=abc"],
    ["the state differs", "https://127.0.0.1:3000/?code=abc&state=s2"],
  ])("throws SchwabError when %s", (_, callbackUrl) => {
    expect(() => parseCallback(callbackUrl, "s1")).toThrow(SchwabError);
  });
});

describe("exchangeCode", () => {
  it("posts the code and callback URL to the token endpoint with the app credentials", async () => {
    const fetchMock = stubFetch(200, tokenResponse);
    await exchangeCode(config, "C0.abc@");
    expect(sentRequest(fetchMock)).toEqual({
      url: "https://api.schwabapi.com/v1/oauth/token",
      method: "POST",
      headers: { Authorization: `Basic ${btoa("key:secret")}` },
      body: {
        grant_type: "authorization_code",
        code: "C0.abc@",
        redirect_uri: "https://127.0.0.1:3000",
      },
    });
  });

  it("returns tokens whose access expiry is expires_in after receipt and whose login starts now", async () => {
    stubFetch(200, tokenResponse);
    expect(await exchangeCode(config, "C0.abc@")).toEqual({
      accessToken: "access-1",
      refreshToken: "refresh-1",
      accessExpiresAt: "2026-10-02T12:30:00.000Z",
      refreshIssuedAt: "2026-10-02T12:00:00.000Z",
    });
  });

  it("throws LoginRequiredError when Schwab rejects the code", async () => {
    stubFetch(400, { error: "invalid_grant" });
    await expect(exchangeCode(config, "expired")).rejects.toThrow(
      LoginRequiredError,
    );
  });

  it("throws SchwabError when the response has no refresh token", async () => {
    stubFetch(200, { ...tokenResponse, refresh_token: undefined });
    await expect(exchangeCode(config, "C0.abc@")).rejects.toThrow(SchwabError);
  });
});

describe("completeLogin", () => {
  let dir: string;
  let session: Session;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "obe-login-"));
    session = { config, tokensPath: join(dir, "tokens.json") };
  });

  afterEach(() => rm(dir, { recursive: true }));

  it("saves the tokens for the callback's code and returns when they expire", async () => {
    stubFetch(200, tokenResponse);
    const callbackUrl = "https://127.0.0.1:3000/?code=C0.abc%40&state=s1";
    expect(await completeLogin(session, callbackUrl, "s1")).toEqual({
      accessExpiresAt: new Date("2026-10-02T12:30:00.000Z"),
      loginExpiresAt: new Date("2026-10-09T12:00:00.000Z"),
    });
    expect(await readTokens(session.tokensPath)).toMatchObject({
      accessToken: "access-1",
      refreshToken: "refresh-1",
    });
  });

  it("throws SchwabError without a request or a saved file when the state differs", async () => {
    const fetchMock = stubFetch(200, tokenResponse);
    const callbackUrl = "https://127.0.0.1:3000/?code=abc&state=s2";
    await expect(completeLogin(session, callbackUrl, "s1")).rejects.toThrow(
      SchwabError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(readTokens(session.tokensPath)).rejects.toThrow(
      LoginRequiredError,
    );
  });
});

describe("getLoginStatus", () => {
  let dir: string;
  let tokensPath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "obe-status-"));
    tokensPath = join(dir, "tokens.json");
  });

  afterEach(() => rm(dir, { recursive: true }));

  it("returns when the access token and login expire, without the tokens", async () => {
    await writeTokens(tokensPath, {
      accessToken: "access-1",
      refreshToken: "refresh-1",
      accessExpiresAt: "2026-10-02T12:30:00.000Z",
      refreshIssuedAt: "2026-10-02T12:00:00.000Z",
    });
    expect(await getLoginStatus(tokensPath)).toEqual({
      accessExpiresAt: new Date("2026-10-02T12:30:00.000Z"),
      loginExpiresAt: new Date("2026-10-09T12:00:00.000Z"),
    });
  });

  it("throws LoginRequiredError when there is no token file", async () => {
    await expect(getLoginStatus(tokensPath)).rejects.toThrow(
      LoginRequiredError,
    );
  });
});

describe("getAccessToken", () => {
  let dir: string;
  let session: Session;

  const saved: Tokens = {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    accessExpiresAt: "2026-10-02T12:05:00.000Z",
    refreshIssuedAt: "2026-09-30T12:00:00.000Z",
  };

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "obe-auth-"));
    session = { config, tokensPath: join(dir, "tokens.json") };
  });

  afterEach(() => rm(dir, { recursive: true }));

  async function savedTokens(): Promise<Tokens> {
    return JSON.parse(await readFile(session.tokensPath, "utf8"));
  }

  it("returns the saved token without a request while more than five minutes remain", async () => {
    await writeTokens(session.tokensPath, {
      ...saved,
      accessExpiresAt: "2026-10-02T12:05:01.000Z",
    });
    const fetchMock = stubFetch(500, {});
    expect(await getAccessToken(session)).toBe("access-1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshes and saves new tokens when five minutes or less remain", async () => {
    await writeTokens(session.tokensPath, saved);
    const fetchMock = stubFetch(200, {
      access_token: "access-2",
      refresh_token: "refresh-2",
      expires_in: 1800,
    });
    expect(await getAccessToken(session)).toBe("access-2");
    expect(sentRequest(fetchMock)).toMatchObject({
      url: "https://api.schwabapi.com/v1/oauth/token",
      method: "POST",
      headers: { Authorization: `Basic ${btoa("key:secret")}` },
      body: { grant_type: "refresh_token", refresh_token: "refresh-1" },
    });
    expect(await savedTokens()).toEqual({
      accessToken: "access-2",
      refreshToken: "refresh-2",
      accessExpiresAt: "2026-10-02T12:30:00.000Z",
      refreshIssuedAt: saved.refreshIssuedAt,
    });
  });

  it("keeps the old refresh token when the refresh response omits it", async () => {
    await writeTokens(session.tokensPath, saved);
    stubFetch(200, { access_token: "access-2", expires_in: 1800 });
    await getAccessToken(session);
    expect((await savedTokens()).refreshToken).toBe("refresh-1");
  });

  it("throws LoginRequiredError when there is no token file", async () => {
    await expect(getAccessToken(session)).rejects.toThrow(LoginRequiredError);
  });

  it("throws LoginRequiredError without a request once seven days have passed since login", async () => {
    await writeTokens(session.tokensPath, {
      ...saved,
      refreshIssuedAt: "2026-09-25T12:00:00.000Z",
    });
    const fetchMock = stubFetch(200, {});
    await expect(getAccessToken(session)).rejects.toThrow(LoginRequiredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([400, 401])(
    "throws LoginRequiredError when the refresh returns %i",
    async (status) => {
      await writeTokens(session.tokensPath, saved);
      stubFetch(status, { error: "invalid_grant" });
      await expect(getAccessToken(session)).rejects.toThrow(LoginRequiredError);
    },
  );

  it("throws a SchwabError that does not ask for a login when the refresh returns 500", async () => {
    await writeTokens(session.tokensPath, saved);
    stubFetch(500, { error: "server_error" });
    const error = await getAccessToken(session).catch((caught) => caught);
    expect(error).toBeInstanceOf(SchwabError);
    expect(error).not.toBeInstanceOf(LoginRequiredError);
    expect(await savedTokens()).toEqual(saved);
  });

  it("throws SchwabError when the token endpoint cannot be reached", async () => {
    await writeTokens(session.tokensPath, saved);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed");
      }),
    );
    await expect(getAccessToken(session)).rejects.toThrow(SchwabError);
  });
});
