import type { LoginStatus } from "../schwab/auth.ts";

/**
 * Formats when the access token and the login expire, marking times already past as expired.
 *
 * @param status - Expiration times from `getLoginStatus`.
 * @returns One line for the access token and one for the login.
 */
export function formatLoginStatus(status: LoginStatus): string {
  const rows: [string, Date][] = [
    ["Access token", status.accessExpiresAt],
    ["Login", status.loginExpiresAt],
  ];
  return rows
    .map(([label, time]) => {
      const verb = time.getTime() <= Date.now() ? "expired" : "expires";
      return `${label.padEnd(12)}  ${verb} ${time.toLocaleString()}`;
    })
    .join("\n");
}
