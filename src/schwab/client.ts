import { z } from "zod";
import { getAccessToken, type Session } from "./auth.ts";
import { networkFailure, SchwabError } from "./errors.ts";

const serviceErrorSchema = z.object({ message: z.string() });

/**
 * Sends an authenticated GET to the Schwab API and validates the JSON response.
 *
 * @param session - App credentials and token file.
 * @param path - API path, such as `/trader/v1/accounts`.
 * @param schema - Schema the response body must match.
 * @returns The validated response body.
 * @throws SchwabError with the status, Schwab's message, and the correlation ID when the request
 * fails, or when the body does not match the schema.
 */
export async function schwabGet<T>(
  session: Session,
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const accessToken = await getAccessToken(session);
  const response = await fetch(
    new URL(path, session.config.SCHWAB_API_BASE_URL),
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  ).catch(networkFailure);
  if (!response.ok) {
    throw new SchwabError(await describeFailure(path, response));
  }
  const result = schema.safeParse(await response.json().catch(() => undefined));
  if (!result.success) {
    throw new SchwabError(
      `Unexpected response from GET ${path}\n${z.prettifyError(result.error)}`,
    );
  }
  return result.data;
}

async function describeFailure(
  path: string,
  response: Response,
): Promise<string> {
  const body = serviceErrorSchema.safeParse(
    await response.json().catch(() => undefined),
  );
  const message = body.success ? body.data.message : response.statusText;
  const correlId = response.headers.get("Schwab-Client-CorrelId");
  const suffix = correlId ? ` (correlation ID ${correlId})` : "";
  return `GET ${path} failed with ${response.status}: ${message}${suffix}`;
}
