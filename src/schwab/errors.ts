/** A failure the user can act on, such as a rejected Schwab request or an invalid callback URL. */
export class SchwabError extends Error {}

/** A failure that only a new browser login fixes. */
export class LoginRequiredError extends SchwabError {}

/**
 * Rethrows a `fetch` rejection as a SchwabError naming the network cause.
 *
 * @param error - The rejection from `fetch`.
 * @throws SchwabError always.
 */
export function networkFailure(error: unknown): never {
  const cause = error instanceof Error && error.cause ? error.cause : error;
  const detail = cause instanceof Error ? cause.message : String(cause);
  throw new SchwabError(`Could not reach Schwab: ${detail}`);
}
