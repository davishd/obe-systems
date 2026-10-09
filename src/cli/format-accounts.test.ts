import { describe, expect, it } from "vitest";
import type { Account } from "../schwab/accounts.ts";
import { formatAccounts } from "./format-accounts.ts";

const margin: Account = {
  securitiesAccount: {
    type: "MARGIN",
    accountNumber: "12345678",
    currentBalances: {
      equity: 40123.45,
      buyingPower: 71000,
      availableFunds: 35500,
      maintenanceRequirement: 4537.04,
    },
  },
};

const cash: Account = {
  securitiesAccount: {
    type: "CASH",
    accountNumber: "87654321",
    currentBalances: {
      totalCash: 5000,
      cashAvailableForTrading: 5000,
      cashAvailableForWithdrawal: 4800,
      unsettledCash: 200,
    },
  },
};

describe("formatAccounts", () => {
  it("prints each account's masked number, type, and current balances", () => {
    expect(formatAccounts([margin, cash])).toBe(
      [
        "****5678  MARGIN",
        "  Equity                   $40,123.45",
        "  Buying power             $71,000.00",
        "  Available funds          $35,500.00",
        "  Maintenance requirement   $4,537.04",
        "",
        "****4321  CASH",
        "  Total cash                     $5,000.00",
        "  Cash available for trading     $5,000.00",
        "  Cash available for withdrawal  $4,800.00",
        "  Unsettled cash                   $200.00",
      ].join("\n"),
    );
  });

  it("says so when no accounts are linked", () => {
    expect(formatAccounts([])).toBe("No linked accounts.");
  });
});
