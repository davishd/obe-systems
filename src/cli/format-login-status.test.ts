import { afterEach, describe, expect, it, vi } from "vitest";
import type { LoginStatus } from "../schwab/auth.ts";
import { formatLoginStatus } from "./format-login-status.ts";

const status: LoginStatus = {
  accessExpiresAt: new Date("2026-10-02T12:30:00.000Z"),
  loginExpiresAt: new Date("2026-10-09T12:00:00.000Z"),
};

const accessTime = status.accessExpiresAt.toLocaleString();
const loginTime = status.loginExpiresAt.toLocaleString();

afterEach(() => {
  vi.useRealTimers();
});

describe("formatLoginStatus", () => {
  it("says when the access token and the login expire", () => {
    vi.setSystemTime(new Date("2026-10-02T12:10:00.000Z"));
    expect(formatLoginStatus(status)).toBe(
      [
        `Access token  expires ${accessTime}`,
        `Login         expires ${loginTime}`,
      ].join("\n"),
    );
  });

  it("marks times that have passed as expired", () => {
    vi.setSystemTime(new Date("2026-10-09T12:00:00.000Z"));
    expect(formatLoginStatus(status)).toBe(
      [
        `Access token  expired ${accessTime}`,
        `Login         expired ${loginTime}`,
      ].join("\n"),
    );
  });
});
