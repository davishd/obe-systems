import { z } from "zod";

const configSchema = z.object({
  SCHWAB_API_BASE_URL: z.url(),
  SCHWAB_CALLBACK_URL: z.url(),
  SCHWAB_APP_KEY: z.string(),
  SCHWAB_APP_SECRET: z.string(),
});

/** Schwab settings and secrets read from the environment. */
export type Config = z.infer<typeof configSchema>;

/**
 * Validates the Schwab variables in an environment.
 *
 * @param env - Environment variables to read.
 * @returns The typed config.
 * @throws ZodError listing each missing or malformed variable.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return configSchema.parse(env);
}
