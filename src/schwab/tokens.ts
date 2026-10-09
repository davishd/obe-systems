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
    const data = JSON.parse(text);
    return tokensSchema.parse(data);
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
  const text = `${JSON.stringify(tokens, null, 2)}\n`;
  await writeFile(path, text, { mode: 0o600 });
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
