import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Session } from "./auth.ts";
import { schwabGet } from "./client.ts";
import { LoginRequiredError, SchwabError } from "./errors.ts";
import { writeTokens } from "./tokens.ts";

let dir: string;
let session: Session;

beforeEach(async () => {
  vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
  dir = await mkdtemp(join(tmpdir(), "obe-client-"));
  session = {
    config: {
      SCHWAB_API_BASE_URL: "https://api.schwabapi.com",
      SCHWAB_CALLBACK_URL: "https://127.0.0.1:3000",
      SCHWAB_APP_KEY: "key",
      SCHWAB_APP_SECRET: "secret",
    },
    tokensPath: join(dir, "tokens.json"),
  };
  await writeTokens(session.tokensPath, {
    accessToken: "access-1",
    refreshToken: "refresh-1",
    accessExpiresAt: "2026-10-02T12:30:00.000Z",
    refreshIssuedAt: "2026-10-02T12:00:00.000Z",
  });
});

afterEach(async () => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  await rm(dir, { recursive: true });
});

describe("schwabGet", () => {
  const schema = z.object({ ok: z.boolean() });

  it("sends the saved access token as a bearer token and returns the validated body", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", fetchMock);
    expect(await schwabGet(session, "/trader/v1/accounts", schema)).toEqual({
      ok: true,
    });
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe("https://api.schwabapi.com/trader/v1/accounts");
    expect(init?.headers).toEqual({ Authorization: "Bearer access-1" });
  });

  it("throws with the status, Schwab's message, and the correlation ID, without asking for a login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json(
          { message: "Client not authorized", errors: [] },
          { status: 401, headers: { "Schwab-Client-CorrelId": "corr-123" } },
        ),
      ),
    );
    const error = await schwabGet(session, "/trader/v1/accounts", schema).catch(
      (caught) => caught,
    );
    expect(error).toBeInstanceOf(SchwabError);
    expect(error).not.toBeInstanceOf(LoginRequiredError);
    expect(error.message).toBe(
      "GET /trader/v1/accounts failed with 401: Client not authorized (correlation ID corr-123)",
    );
  });

  it("throws SchwabError when the body does not match the schema", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ ok: "yes" })),
    );
    await expect(
      schwabGet(session, "/trader/v1/accounts", schema),
    ).rejects.toThrow(SchwabError);
  });

  it("throws SchwabError when the body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html></html>")),
    );
    await expect(
      schwabGet(session, "/trader/v1/accounts", schema),
    ).rejects.toThrow(SchwabError);
  });

  it("throws SchwabError naming the cause when Schwab cannot be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("fetch failed", {
          cause: new Error("getaddrinfo ENOTFOUND api.schwabapi.com"),
        });
      }),
    );
    await expect(
      schwabGet(session, "/trader/v1/accounts", schema),
    ).rejects.toThrow(
      new SchwabError(
        "Could not reach Schwab: getaddrinfo ENOTFOUND api.schwabapi.com",
      ),
    );
  });
});
