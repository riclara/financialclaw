import { DatabaseSync } from "node:sqlite";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { getDb } from "../db/database.js";
import {
  resolvePeriodRange,
  type SupportedPeriod,
} from "./helpers/date-utils.js";
import {
  formatAmount,
  resolveCurrency,
  type CurrencyRow,
} from "./helpers/currency-utils.js";

export const InputSchema = Type.Object(
  {
    period: Type.Optional(
      Type.Union([
        Type.Literal("this_month"),
        Type.Literal("last_month"),
        Type.Literal("last_30_days"),
        Type.Literal("this_year"),
      ]),
    ),
    currency: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type GetFinancialSummaryInput = Static<typeof InputSchema>;

interface ExpenseCatRow {
  currency: string;
  category: string | null;
  total: number;
}

interface CurrencyTotalRow {
  currency: string;
  total: number;
}

interface RuleRow {
  name: string;
  amount: number;
  currency: string;
  frequency: string;
  interval_days: number | null;
}

const PERIOD_LABELS: Record<SupportedPeriod, string> = {
  this_month: "this month",
  last_month: "last month",
  last_30_days: "last 30 days",
  this_year: "this year",
  all: "all",
};

function monthlyEquivalent(
  amount: number,
  frequency: string,
  intervalDays: number | null,
): number {
  switch (frequency) {
    case "MONTHLY":
      return amount;
    case "WEEKLY":
      return Math.round(amount * 4.33);
    case "BIWEEKLY":
      return Math.round(amount * 2.17);
    case "INTERVAL_DAYS":
      return intervalDays ? Math.round((amount * 30) / intervalDays) : amount;
    default:
      return amount;
  }
}

export function executeGetFinancialSummary(
  input: GetFinancialSummaryInput,
  db: DatabaseSync = getDb(),
): string {
  if (!Value.Check(InputSchema, input)) {
    throw new Error(
      "Invalid parameters: period must be one of: this_month, last_month, last_30_days, this_year.",
    );
  }

  const period = (input.period ?? "this_month") as SupportedPeriod;
  const range = resolvePeriodRange(period);
  if (!range) {
    throw new Error("The 'all' period is not supported by get_financial_summary.");
  }

  // Validate currency filter if provided — throws descriptively if not registered
  const filterCode = input.currency?.trim() || undefined;
  if (filterCode) {
    resolveCurrency(filterCode, db);
  }
  const filter = filterCode ?? null;

  // ── Queries ────────────────────────────────────────────────────────────────

  // Total expenses by currency and category within the period
  const expenseByCat = db
    .prepare(
      `SELECT currency, category, SUM(amount) AS total
       FROM expenses
       WHERE due_date BETWEEN ? AND ? AND is_active = 1
         AND (? IS NULL OR currency = ?)
       GROUP BY currency, category`,
    )
    .all(range.start, range.end, filter, filter) as unknown as ExpenseCatRow[];

  // Pending expenses by currency within the period
  const pendingByCurrency = db
    .prepare(
      `SELECT currency, SUM(amount) AS total
       FROM expenses
       WHERE status = 'PENDING' AND due_date BETWEEN ? AND ? AND is_active = 1
         AND (? IS NULL OR currency = ?)
       GROUP BY currency`,
    )
    .all(range.start, range.end, filter, filter) as unknown as CurrencyTotalRow[];

  // Income received by currency within the period
  // (income_receipts.amount / income_receipts.date — real columns, not doc aliases)
  const incomeByCurrency = db
    .prepare(
      `SELECT currency, SUM(amount) AS total
       FROM income_receipts
       WHERE date BETWEEN ? AND ?
         AND (? IS NULL OR currency = ?)
       GROUP BY currency`,
    )
    .all(range.start, range.end, filter, filter) as unknown as CurrencyTotalRow[];

  // Active recurring rules — independent of the period
  // recurring_expense_rules.name = what the user called "description" in the input
  const rules = db
    .prepare(
      `SELECT name, amount, currency, frequency, interval_days
       FROM recurring_expense_rules
       WHERE is_active = 1
         AND (? IS NULL OR currency = ?)`,
    )
    .all(filter, filter) as unknown as RuleRow[];

  // ── Collect all relevant currencies ───────────────────────────────────────

  const allCurrencies = new Set<string>();
  for (const r of expenseByCat) allCurrencies.add(r.currency);
  for (const r of pendingByCurrency) allCurrencies.add(r.currency);
  for (const r of incomeByCurrency) allCurrencies.add(r.currency);
  for (const r of rules) allCurrencies.add(r.currency);
  // If a currency filter was applied, always show that section even if empty
  if (filterCode) allCurrencies.add(filterCode);

  // ── Format output ──────────────────────────────────────────────────────────

  const periodLabel = PERIOD_LABELS[period];
  const lines: string[] = [
    `Period: ${periodLabel} (${range.start} – ${range.end})`,
    "",
  ];

  if (allCurrencies.size === 0) {
    lines.push("No transactions recorded in this period.");
    lines.push("");
    lines.push("Active recurring commitments: 0");
    return lines.join("\n");
  }

  // Fetch currency rows for amount formatting
  const currencyCache = new Map<string, CurrencyRow>();
  for (const code of allCurrencies) {
    const row = db
      .prepare(
        `SELECT code, name, symbol, is_default FROM currencies WHERE code = ?`,
      )
      .get(code) as unknown as CurrencyRow | undefined;
    if (row) currencyCache.set(code, row);
  }

  // One section per currency, sorted alphabetically
  for (const code of [...allCurrencies].sort()) {
    const currencyRow = currencyCache.get(code);
    if (!currencyRow) continue;

    const fmt = (amount: number) => formatAmount(amount, currencyRow);

    const catRows = expenseByCat.filter((r) => r.currency === code);
    const totalExpenses = catRows.reduce((sum, r) => sum + r.total, 0);
    const totalPending =
      pendingByCurrency.find((r) => r.currency === code)?.total ?? 0;
    const totalIncome =
      incomeByCurrency.find((r) => r.currency === code)?.total ?? 0;
    const balance = totalIncome - totalExpenses;

    lines.push(code);
    lines.push(`Income received:     ${fmt(totalIncome)}`);
    lines.push(`Total expenses:      ${fmt(totalExpenses)}`);
    lines.push(`Pending expenses:    ${fmt(totalPending)}`);
    lines.push(`Received balance:    ${fmt(balance)}`);

    if (catRows.length > 0) {
      lines.push("");
      lines.push("By category:");
      for (const cat of [...catRows].sort((a, b) => b.total - a.total)) {
        lines.push(
          `  ${cat.category ?? "UNCATEGORIZED"}  ${fmt(cat.total)}`,
        );
      }
    }

    const currencyRules = rules.filter((r) => r.currency === code);
    if (currencyRules.length > 0) {
      const totalMonthly = currencyRules.reduce(
        (sum, r) =>
          sum + monthlyEquivalent(r.amount, r.frequency, r.interval_days),
        0,
      );
      lines.push("");
      lines.push(
        `Active recurring commitments: ${currencyRules.length} (${fmt(totalMonthly)}/mo)`,
      );
      for (const rule of currencyRules) {
        lines.push(`  ${rule.name}  ${fmt(rule.amount)} (${rule.frequency})`);
      }
    }

    lines.push("");
  }

  // If no active rules exist at all, append global zero count
  if (rules.length === 0) {
    lines.push("Active recurring commitments: 0");
  }

  return lines.join("\n").trimEnd();
}
