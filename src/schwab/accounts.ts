import { z } from "zod";
import type { Session } from "./auth.ts";
import { schwabGet } from "./client.ts";

const marginAccountSchema = z.object({
  type: z.literal("MARGIN"),
  accountNumber: z.string(),
  currentBalances: z.object({
    equity: z.number(),
    buyingPower: z.number(),
    availableFunds: z.number(),
    maintenanceRequirement: z.number(),
  }),
});

const cashAccountSchema = z.object({
  type: z.literal("CASH"),
  accountNumber: z.string(),
  currentBalances: z.object({
    totalCash: z.number(),
    cashAvailableForTrading: z.number(),
    cashAvailableForWithdrawal: z.number(),
    unsettledCash: z.number(),
  }),
});

const accountSchema = z.object({
  securitiesAccount: z.discriminatedUnion("type", [
    marginAccountSchema,
    cashAccountSchema,
  ]),
});

/** A linked Schwab account and its current balances. */
export type Account = z.infer<typeof accountSchema>;

const accountsSchema = z.array(accountSchema);

/**
 * Fetches every account linked to the Schwab login.
 *
 * @param session - App credentials and token file.
 * @returns The linked accounts with their current balances.
 */
export function getAccounts(session: Session): Promise<Account[]> {
  return schwabGet(session, "/trader/v1/accounts", accountsSchema);
}
