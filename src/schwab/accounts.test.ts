import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type Account, getAccounts } from "./accounts.ts";
import type { Session } from "./auth.ts";
import { writeTokens } from "./tokens.ts";

const fixture = await readFile(
  new URL("./fixtures/accounts.json", import.meta.url),
  "utf8",
);

const margin: Account = {
  securitiesAccount: {
    type: "MARGIN",
    accountNumber: "12345678",
    currentBalances: {
      equity: 40123.45,
      buyingPower: 71000,
      availableFunds: 35500,
      maintenanceRequirement: 4537.04,
    },
  },
};

const cash: Account = {
  securitiesAccount: {
    type: "CASH",
    accountNumber: "87654321",
    currentBalances: {
      totalCash: 5000,
      cashAvailableForTrading: 5000,
      cashAvailableForWithdrawal: 4800,
      unsettledCash: 200,
    },
  },
};

describe("getAccounts", () => {
  let dir: string;
  let session: Session;

  beforeEach(async () => {
    vi.setSystemTime(new Date("2026-10-02T12:00:00.000Z"));
    dir = await mkdtemp(join(tmpdir(), "obe-accounts-"));
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

  it("requests /trader/v1/accounts and keeps the printed fields of each account", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(fixture));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getAccounts(session)).toEqual([margin, cash]);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://api.schwabapi.com/trader/v1/accounts",
    );
  });
});
