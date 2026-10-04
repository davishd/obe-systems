import { chmod, readFile, writeFile } from "node:fs/promises";
import { z } from "zod";
import { LoginRequiredError } from "./errors.ts";

const LOGIN_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const tokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  accessExpiresAt: z.iso.datetime(),
  refreshIssuedAt: z.iso.datetime(),
});

/** The Schwab OAuth tokens saved in the token file. */
export type Tokens = z.infer<typeof tokensSchema>;

/**
 * Reads the saved tokens.
 *
 * @param path - Token file to read.
 * @returns The saved tokens.
 * @throws LoginRequiredError when the file is missing or invalid.
 */
export async function readTokens(path: string): Promise<Tokens> {
  const text = await readFile(path, "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        throw new LoginRequiredError("No Schwab login found.");
      }
      throw error;
    },
  );
  try {
    return tokensSchema.parse(JSON.parse(text));
  } catch {
    throw new LoginRequiredError(`${path} is not a valid token file.`);
  }
}

/**
 * Saves tokens to a file only the owner can read.
 *
 * @param path - Token file to write.
 * @param tokens - Tokens to save.
 */
export async function writeTokens(path: string, tokens: Tokens): Promise<void> {
  await writeFile(path, `${JSON.stringify(tokens, null, 2)}\n`, {
    mode: 0o600,
  });
  // `mode` applies only when the file is created.
  await chmod(path, 0o600);
}

/**
 * Computes when the refresh token stops working and a browser login is needed again.
 *
 * @param tokens - Saved tokens.
 * @returns Seven days after `refreshIssuedAt`.
 */
export function loginExpiresAt(tokens: Tokens): Date {
  return new Date(Date.parse(tokens.refreshIssuedAt) + LOGIN_LIFETIME_MS);
}

/**
 * Formats when the access token and the login expire, marking times already past as expired.
 *
 * @param tokens - Saved tokens.
 * @returns One line for the access token and one for the login.
 */
export function formatStatus(tokens: Tokens): string {
  const rows: [string, Date][] = [
    ["Access token", new Date(tokens.accessExpiresAt)],
    ["Login", loginExpiresAt(tokens)],
  ];
  return rows
    .map(([label, time]) => {
      const verb = time.getTime() <= Date.now() ? "expired" : "expires";
      return `${label.padEnd(12)}  ${verb} ${time.toLocaleString()}`;
    })
    .join("\n");
}
