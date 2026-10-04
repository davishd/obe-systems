import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoginRequiredError } from "./errors.ts";
import {
  formatStatus,
  loginExpiresAt,
  readTokens,
  type Tokens,
  writeTokens,
} from "./tokens.ts";

const tokens: Tokens = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  accessExpiresAt: "2026-10-02T12:30:00.000Z",
  refreshIssuedAt: "2026-10-02T12:00:00.000Z",
};

let dir: string;
let path: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "obe-tokens-"));
  path = join(dir, "tokens.json");
});

afterEach(() => rm(dir, { recursive: true }));

describe("writeTokens", () => {
  it("writes the tokens as JSON readable only by the owner", async () => {
    await writeTokens(path, tokens);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(tokens);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it("replaces an existing file and restricts it to the owner", async () => {
    await writeFile(path, "old", { mode: 0o644 });
    await writeTokens(path, tokens);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(tokens);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });
});

describe("readTokens", () => {
  it("returns the saved tokens", async () => {
    await writeTokens(path, tokens);
    expect(await readTokens(path)).toEqual(tokens);
  });

  it("throws LoginRequiredError when the file is missing", async () => {
    await expect(readTokens(path)).rejects.toThrow(LoginRequiredError);
  });

  it.each([
    ["not JSON", "{"],
    ["missing a field", JSON.stringify({ ...tokens, refreshToken: undefined })],
  ])("throws LoginRequiredError when the file is %s", async (_, text) => {
    await writeFile(path, text);
    await expect(readTokens(path)).rejects.toThrow(LoginRequiredError);
  });
});

describe("loginExpiresAt", () => {
  it("is seven days after the refresh token was issued", () => {
    expect(loginExpiresAt(tokens)).toEqual(
      new Date("2026-10-09T12:00:00.000Z"),
    );
  });
});

describe("formatStatus", () => {
  const accessTime = new Date(tokens.accessExpiresAt).toLocaleString();
  const loginTime = new Date("2026-10-09T12:00:00.000Z").toLocaleString();

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says when the access token and the login expire", () => {
    vi.setSystemTime(new Date("2026-10-02T12:10:00.000Z"));
    expect(formatStatus(tokens)).toBe(
      [
        `Access token  expires ${accessTime}`,
        `Login         expires ${loginTime}`,
      ].join("\n"),
    );
  });

  it("marks times that have passed as expired", () => {
    vi.setSystemTime(new Date("2026-10-09T12:00:00.000Z"));
    expect(formatStatus(tokens)).toBe(
      [
        `Access token  expired ${accessTime}`,
        `Login         expired ${loginTime}`,
      ].join("\n"),
    );
  });
});
