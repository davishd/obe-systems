import type { Account } from "../schwab/accounts.ts";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

/**
 * Formats accounts for the terminal, showing only the last four digits of each account number.
 *
 * @param accounts - Accounts from `getAccounts`.
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
