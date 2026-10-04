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

/** A linked Schwab account with the balances `formatAccounts` prints. */
export type Account = z.infer<typeof accountSchema>;

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * Fetches every account linked to the Schwab login.
 *
 * @param session - App credentials and token file.
 * @returns The linked accounts with their current balances.
 */
export function getAccounts(session: Session): Promise<Account[]> {
  return schwabGet(session, "/trader/v1/accounts", z.array(accountSchema));
}

/**
 * Formats accounts for the terminal, showing only the last four digits of each account number.
 *
 * @param accounts - Accounts from {@link getAccounts}.
 * @returns One block per account: masked number, type, and current balances.
 */
export function formatAccounts(accounts: Account[]): string {
  if (accounts.length === 0) return "No linked accounts.";
  return accounts
    .map(({ securitiesAccount }) => formatAccount(securitiesAccount))
    .join("\n\n");
}

function formatAccount(account: Account["securitiesAccount"]): string {
  const rows = balanceRows(account).map(
    ([label, amount]) => [label, usd.format(amount)] as const,
  );
  const labelWidth = Math.max(...rows.map(([label]) => label.length));
  const amountWidth = Math.max(...rows.map(([, amount]) => amount.length));
  return [
    `****${account.accountNumber.slice(-4)}  ${account.type}`,
    ...rows.map(
      ([label, amount]) =>
        `  ${label.padEnd(labelWidth)}  ${amount.padStart(amountWidth)}`,
    ),
  ].join("\n");
}

function balanceRows(
  account: Account["securitiesAccount"],
): [string, number][] {
  if (account.type === "MARGIN") {
    const balances = account.currentBalances;
    return [
      ["Equity", balances.equity],
      ["Buying power", balances.buyingPower],
      ["Available funds", balances.availableFunds],
      ["Maintenance requirement", balances.maintenanceRequirement],
    ];
  }
  const balances = account.currentBalances;
  return [
    ["Total cash", balances.totalCash],
    ["Cash available for trading", balances.cashAvailableForTrading],
    ["Cash available for withdrawal", balances.cashAvailableForWithdrawal],
    ["Unsettled cash", balances.unsettledCash],
  ];
}
