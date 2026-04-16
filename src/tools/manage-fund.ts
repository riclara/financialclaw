import { randomUUID } from "node:crypto";

import { DatabaseSync } from "node:sqlite";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { getDb } from "../db/database.js";
import { todayISO } from "./helpers/date-utils.js";
import {
  type CurrencyRow,
  formatAmount,
  PLACEHOLDER_CURRENCY,
  resolveCurrency,
} from "./helpers/currency-utils.js";

const ACTIONS = ["create", "list", "deposit", "withdraw", "archive"] as const;
const FUND_TYPES = ["savings", "account"] as const;
const CONTRIBUTION_FREQUENCIES = [
  "WEEKLY",
  "BIWEEKLY",
  "MONTHLY",
  "INTERVAL_DAYS",
] as const;
const ISO_DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

interface FundRow {
  id: string;
  name: string;
  type: (typeof FUND_TYPES)[number];
  currency: string;
  initial_balance: number;
  contribution_amount: number | null;
  contribution_frequency: string | null;
  contribution_interval_days: number | null;
  contribution_required: number;
  contribution_starts_on: string | null;
  target_amount: number | null;
  target_date: string | null;
  is_active: number;
  currency_name: string;
  currency_symbol: string;
}

interface ListedFundRow extends FundRow {
  transaction_delta: number;
}

export const InputSchema = Type.Object(
  {
    action: Type.Union(ACTIONS.map((action) => Type.Literal(action))),
    name: Type.Optional(Type.String()),
    type: Type.Optional(Type.Union(FUND_TYPES.map((fundType) => Type.Literal(fundType)))),
    currency: Type.Optional(Type.String()),
    initial_balance: Type.Optional(Type.Number()),
    contribution_amount: Type.Optional(Type.Number({ minimum: 1 })),
    contribution_frequency: Type.Optional(
      Type.Union(CONTRIBUTION_FREQUENCIES.map((frequency) => Type.Literal(frequency))),
    ),
    contribution_interval_days: Type.Optional(Type.Integer({ minimum: 1 })),
    contribution_required: Type.Optional(Type.Boolean()),
    contribution_starts_on: Type.Optional(Type.String({ pattern: ISO_DATE_PATTERN })),
    target_amount: Type.Optional(Type.Number({ minimum: 1 })),
    target_date: Type.Optional(Type.String({ pattern: ISO_DATE_PATTERN })),
    fund: Type.Optional(Type.String()),
    amount: Type.Optional(Type.Number({ minimum: 1 })),
    date: Type.Optional(Type.String({ pattern: ISO_DATE_PATTERN })),
    notes: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type ManageFundInput = Static<typeof InputSchema>;

function isValidCalendarDate(dateStr: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (match === null) {
    return false;
  }

  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  return (
    candidate.getUTCFullYear() === year &&
    candidate.getUTCMonth() === month - 1 &&
    candidate.getUTCDate() === day
  );
}

function requireText(value: string | undefined, fieldName: string, action: string): string {
  const normalized = value?.trim();

  if (normalized === undefined || normalized === "") {
    throw new Error(`Action ${action} requires the "${fieldName}" field.`);
  }

  return normalized;
}

function validateDateField(value: string | undefined, fieldName: string): void {
  if (value !== undefined && !isValidCalendarDate(value)) {
    throw new Error(`The ${fieldName} date "${value}" is not a valid calendar date.`);
  }
}

function getCurrencyFromFund(fund: FundRow): CurrencyRow {
  return {
    code: fund.currency,
    name: fund.currency_name,
    symbol: fund.currency_symbol,
  };
}

function getContributionLabel(
  amount: number | null,
  frequency: string | null,
  intervalDays: number | null,
  required: number,
  startsOn: string | null,
  currency: CurrencyRow,
): string {
  if (amount === null || frequency === null || startsOn === null) {
    return "variable";
  }

  const frequencyLabel =
    frequency === "INTERVAL_DAYS"
      ? `every ${intervalDays} days`
      : frequency.toLowerCase();
  const requiredLabel = required === 1 ? " (required)" : "";

  return `${formatAmount(amount, currency)} ${frequencyLabel}${requiredLabel} from ${startsOn}`;
}

function getFundById(id: string, db: DatabaseSync): FundRow | undefined {
  return db
    .prepare(
      `
        SELECT
          f.id,
          f.name,
          f.type,
          f.currency,
          f.initial_balance,
          f.contribution_amount,
          f.contribution_frequency,
          f.contribution_interval_days,
          f.contribution_required,
          f.contribution_starts_on,
          f.target_amount,
          f.target_date,
          f.is_active,
          c.name AS currency_name,
          c.symbol AS currency_symbol
        FROM funds f
        INNER JOIN currencies c ON c.code = f.currency
        WHERE f.id = ?
        LIMIT 1
      `,
    )
    .get(id) as FundRow | undefined;
}

function getFundsByName(name: string, db: DatabaseSync): FundRow[] {
  return db
    .prepare(
      `
        SELECT
          f.id,
          f.name,
          f.type,
          f.currency,
          f.initial_balance,
          f.contribution_amount,
          f.contribution_frequency,
          f.contribution_interval_days,
          f.contribution_required,
          f.contribution_starts_on,
          f.target_amount,
          f.target_date,
          f.is_active,
          c.name AS currency_name,
          c.symbol AS currency_symbol
        FROM funds f
        INNER JOIN currencies c ON c.code = f.currency
        WHERE lower(f.name) = lower(?)
        ORDER BY f.is_active DESC, f.created_at ASC, f.id ASC
      `,
    )
    .all(name) as unknown as FundRow[];
}

function resolveFund(identifier: string | undefined, db: DatabaseSync): FundRow {
  const normalizedIdentifier = requireText(identifier, "fund", "lookup");
  const exactMatch = getFundById(normalizedIdentifier, db);

  if (exactMatch !== undefined) {
    return exactMatch;
  }

  const nameMatches = getFundsByName(normalizedIdentifier, db);

  if (nameMatches.length === 0) {
    throw new Error(`No fund found for "${normalizedIdentifier}".`);
  }

  const activeMatches = nameMatches.filter((fund) => fund.is_active === 1);

  if (activeMatches.length === 1) {
    return activeMatches[0];
  }

  if (activeMatches.length > 1 || nameMatches.length > 1) {
    throw new Error(`Fund name "${normalizedIdentifier}" is ambiguous. Use the fund ID instead.`);
  }

  return nameMatches[0];
}

function getTransactionDelta(fundId: string, db: DatabaseSync): number {
  const row = db
    .prepare(
      `
        SELECT COALESCE(
          SUM(
            CASE
              WHEN type = 'deposit' THEN amount
              WHEN type = 'withdrawal' THEN -amount
              ELSE 0
            END
          ),
          0
        ) AS transaction_delta
        FROM fund_transactions
        WHERE fund_id = ?
      `,
    )
    .get(fundId) as { transaction_delta: number | null };

  return row.transaction_delta ?? 0;
}

function getCurrentBalance(fund: FundRow, db: DatabaseSync): number {
  return fund.initial_balance + getTransactionDelta(fund.id, db);
}

function buildPlaceholderHint(currencyCode: string): string[] {
  if (currencyCode !== PLACEHOLDER_CURRENCY) {
    return [];
  }

  return [
    "",
    "Hint: you haven't configured a real currency yet. Use manage_currency to add yours and set it as default.",
  ];
}

function createFund(input: ManageFundInput, db: DatabaseSync): string {
  const name = requireText(input.name, "name", "create");

  if (input.type === undefined) {
    throw new Error('Action create requires the "type" field.');
  }

  const currencyCode = requireText(input.currency, "currency", "create");
  const currency = resolveCurrency(currencyCode, db);
  const initialBalance = input.initial_balance ?? 0;

  validateDateField(input.contribution_starts_on, "contribution_starts_on");
  validateDateField(input.target_date, "target_date");

  if (input.contribution_required === true && input.contribution_amount === undefined) {
    throw new Error(
      "A required contribution needs contribution_amount and contribution_frequency.",
    );
  }

  if (input.contribution_amount !== undefined) {
    if (input.contribution_frequency === undefined) {
      throw new Error(
        "The contribution_frequency field is required when contribution_amount is provided.",
      );
    }

    if (input.contribution_starts_on === undefined) {
      throw new Error(
        "The contribution_starts_on field is required when contribution_amount is provided.",
      );
    }
  } else if (
    input.contribution_frequency !== undefined ||
    input.contribution_interval_days !== undefined ||
    input.contribution_starts_on !== undefined ||
    input.contribution_required === true
  ) {
    throw new Error(
      "Contribution details require contribution_amount to be provided first.",
    );
  }

  if (
    input.contribution_frequency === "INTERVAL_DAYS" &&
    input.contribution_interval_days === undefined
  ) {
    throw new Error(
      "The contribution_interval_days field is required when contribution_frequency is INTERVAL_DAYS.",
    );
  }

  const fundId = randomUUID();

  db.prepare(
    `
      INSERT INTO funds (
        id,
        name,
        type,
        currency,
        initial_balance,
        contribution_amount,
        contribution_frequency,
        contribution_interval_days,
        contribution_required,
        contribution_starts_on,
        target_amount,
        target_date,
        is_active
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `,
  ).run(
    fundId,
    name,
    input.type,
    currency.code,
    initialBalance,
    input.contribution_amount ?? null,
    input.contribution_frequency ?? null,
    input.contribution_interval_days ?? null,
    input.contribution_required === true ? 1 : 0,
    input.contribution_starts_on ?? null,
    input.target_amount ?? null,
    input.target_date ?? null,
  );

  const lines = [
    `Fund created: ${name} (${input.type})`,
    `ID: ${fundId}`,
    `Balance: ${formatAmount(initialBalance, currency)}`,
    `Contribution: ${getContributionLabel(
      input.contribution_amount ?? null,
      input.contribution_frequency ?? null,
      input.contribution_interval_days ?? null,
      input.contribution_required === true ? 1 : 0,
      input.contribution_starts_on ?? null,
      currency,
    )}`,
  ];

  if (input.target_amount !== undefined) {
    const targetDateSuffix = input.target_date ? ` before ${input.target_date}` : "";
    lines.push(`Target: ${formatAmount(input.target_amount, currency)}${targetDateSuffix}`);
  } else if (input.target_date !== undefined) {
    lines.push(`Target date: ${input.target_date}`);
  }

  lines.push(...buildPlaceholderHint(currency.code));

  return lines.join("\n");
}

function listFunds(db: DatabaseSync): string {
  const funds = db
    .prepare(
      `
        SELECT
          f.id,
          f.name,
          f.type,
          f.currency,
          f.initial_balance,
          f.contribution_amount,
          f.contribution_frequency,
          f.contribution_interval_days,
          f.contribution_required,
          f.contribution_starts_on,
          f.target_amount,
          f.target_date,
          f.is_active,
          c.name AS currency_name,
          c.symbol AS currency_symbol,
          COALESCE(
            SUM(
              CASE
                WHEN ft.type = 'deposit' THEN ft.amount
                WHEN ft.type = 'withdrawal' THEN -ft.amount
                ELSE 0
              END
            ),
            0
          ) AS transaction_delta
        FROM funds f
        INNER JOIN currencies c ON c.code = f.currency
        LEFT JOIN fund_transactions ft ON ft.fund_id = f.id
        WHERE f.is_active = 1
        GROUP BY
          f.id,
          f.name,
          f.type,
          f.currency,
          f.initial_balance,
          f.contribution_amount,
          f.contribution_frequency,
          f.contribution_interval_days,
          f.contribution_required,
          f.contribution_starts_on,
          f.target_amount,
          f.target_date,
          f.is_active,
          c.name,
          c.symbol
        ORDER BY f.created_at ASC, f.name COLLATE NOCASE ASC
      `,
    )
    .all() as unknown as ListedFundRow[];

  if (funds.length === 0) {
    return "No funds registered.";
  }

  const lines: string[] = [];
  let usesPlaceholderCurrency = false;

  for (const fund of funds) {
    const currency = getCurrencyFromFund(fund);
    const balance = fund.initial_balance + fund.transaction_delta;

    usesPlaceholderCurrency ||= fund.currency === PLACEHOLDER_CURRENCY;
    lines.push(`${fund.name} (${fund.type}) - ${fund.currency}`);
    lines.push(`  Balance: ${formatAmount(balance, currency)}`);
    lines.push(
      `  Contribution: ${getContributionLabel(
        fund.contribution_amount,
        fund.contribution_frequency,
        fund.contribution_interval_days,
        fund.contribution_required,
        fund.contribution_starts_on,
        currency,
      )}`,
    );

    if (fund.target_amount !== null) {
      const progress = Math.round((balance / fund.target_amount) * 100);
      const targetDateSuffix = fund.target_date ? ` before ${fund.target_date}` : "";
      lines.push(
        `  Target: ${formatAmount(fund.target_amount, currency)}${targetDateSuffix} (${progress}%)`,
      );
    } else if (fund.target_date !== null) {
      lines.push(`  Target date: ${fund.target_date}`);
    }

    lines.push("");
  }

  if (usesPlaceholderCurrency) {
    lines.push(...buildPlaceholderHint(PLACEHOLDER_CURRENCY));
  }

  return lines.join("\n").trimEnd();
}

function createTransaction(
  input: ManageFundInput,
  transactionType: "deposit" | "withdrawal",
  db: DatabaseSync,
): string {
  const fund = resolveFund(input.fund, db);

  if (fund.is_active !== 1) {
    throw new Error(`Fund "${fund.name}" is archived and cannot receive new transactions.`);
  }

  if (input.amount === undefined) {
    throw new Error(`Action ${transactionType} requires the "amount" field.`);
  }

  validateDateField(input.date, "date");
  const date = input.date ?? todayISO();
  const notes = input.notes?.trim() || null;

  db.prepare(
    `
      INSERT INTO fund_transactions (id, fund_id, type, amount, date, notes)
      VALUES (?, ?, ?, ?, ?, ?)
    `,
  ).run(randomUUID(), fund.id, transactionType, input.amount, date, notes);

  const currency = getCurrencyFromFund(fund);
  const balance = getCurrentBalance(fund, db);
  const actionLabel = transactionType === "deposit" ? "Deposit" : "Withdrawal";
  const lines = [
    `${actionLabel} recorded for ${fund.name}: ${formatAmount(input.amount, currency)} on ${date}.`,
    `Current balance: ${formatAmount(balance, currency)}`,
  ];

  lines.push(...buildPlaceholderHint(currency.code));

  return lines.join("\n");
}

function archiveFund(input: ManageFundInput, db: DatabaseSync): string {
  const fund = resolveFund(input.fund, db);

  if (fund.is_active !== 1) {
    return `Fund "${fund.name}" is already archived.`;
  }

  db.prepare(
    `
      UPDATE funds
      SET is_active = 0
      WHERE id = ?
    `,
  ).run(fund.id);

  return `Fund "${fund.name}" archived successfully.`;
}

export function executeManageFund(
  input: ManageFundInput,
  db: DatabaseSync = getDb(),
): string {
  if (!Value.Check(InputSchema, input)) {
    throw new Error("Invalid parameters for manage_fund.");
  }

  switch (input.action) {
    case "create":
      return createFund(input, db);
    case "list":
      return listFunds(db);
    case "deposit":
      return createTransaction(input, "deposit", db);
    case "withdraw":
      return createTransaction(input, "withdrawal", db);
    case "archive":
      return archiveFund(input, db);
    default: {
      const exhaustiveCheck: never = input.action;
      throw new Error(`Unsupported action: ${exhaustiveCheck}`);
    }
  }
}
