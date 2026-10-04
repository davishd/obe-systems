import { describe, expect, it } from "vitest";
import { z } from "zod";
import { loadConfig } from "./config.ts";

const env = {
  SCHWAB_API_BASE_URL: "https://api.schwabapi.com",
  SCHWAB_CALLBACK_URL: "https://127.0.0.1:3000",
  SCHWAB_APP_KEY: "key",
  SCHWAB_APP_SECRET: "secret",
};

describe("loadConfig", () => {
  it("returns only the Schwab variables, unchanged", () => {
    expect(loadConfig({ ...env, HOME: "/Users/me" })).toEqual(env);
  });

  it("throws a ZodError naming each missing variable", () => {
    const { SCHWAB_APP_KEY, SCHWAB_APP_SECRET, ...urls } = env;
    const load = () => loadConfig(urls);
    expect(load).toThrow(z.ZodError);
    expect(load).toThrow(/SCHWAB_APP_KEY[\s\S]*SCHWAB_APP_SECRET/);
  });

  it("throws a ZodError when a URL is malformed", () => {
    expect(() =>
      loadConfig({ ...env, SCHWAB_CALLBACK_URL: "not a url" }),
    ).toThrow(/SCHWAB_CALLBACK_URL/);
  });
});
