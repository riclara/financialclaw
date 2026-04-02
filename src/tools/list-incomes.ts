import { DatabaseSync } from "node:sqlite";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { getDb } from "../db/database.js";
import { resolveCurrency, formatAmount, CurrencyRow } from "./helpers/currency-utils.js";

export const InputSchema = Type.Object({
  recurring: Type.Optional(Type.Boolean()),
  search: Type.Optional(Type.String()),
  currency: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
  include_receipts: Type.Optional(Type.Boolean()),
}, { additionalProperties: false });

export type Input = Static<typeof InputSchema>;

function assertValidInput(input: Input): void {
  if (!Value.Check(InputSchema, input)) {
    throw new Error(
      "Invalid parameters: check the types of recurring, search, currency, limit, offset, and include_receipts.",
    );
  }
}

interface IncomeRow {
  id: string;
  reason: string;
  expected_amount: number;
  currency: string;
  date: string;
  frequency: string | null;
  interval_days: number | null;
  is_recurring: number;
  next_expected_receipt_date: string | null;
  is_active: number;
  created_at: string;
}

interface ReceiptRow {
  id: string;
  income_id: string;
  amount: number;
  currency: string;
  date: string;
  notes: string | null;
  created_at: string;
}

export function executeListIncomes(input: Input, db: DatabaseSync = getDb()): string {
  assertValidInput(input);

  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;
  const includeReceipts = input.include_receipts ?? false;

  if (input.currency !== undefined) {
    resolveCurrency(input.currency, db);
  }

  const conditions: string[] = ["1=1"];
  const params: (string | number | null | bigint | Uint8Array)[] = [];

  if (input.recurring !== undefined) {
    conditions.push(`is_recurring = ?`);
    params.push(input.recurring ? 1 : 0);
  }

  if (input.search !== undefined && input.search.trim().length > 0) {
    conditions.push(`reason LIKE ?`);
    params.push(`%${input.search.trim()}%`);
  }

  if (input.currency !== undefined) {
    conditions.push(`currency = ?`);
    params.push(input.currency.trim().toUpperCase());
  }

  const whereClause = conditions.join(" AND ");

  const countSql = `SELECT COUNT(*) as total FROM incomes WHERE ${whereClause}`;
  const countResult = db.prepare(countSql).get(...params) as unknown as { total: number };
  const total = countResult.total;

  const listSql = `
    SELECT id, reason, expected_amount, currency, date, frequency,
           interval_days, is_recurring, next_expected_receipt_date,
           is_active, created_at
    FROM incomes
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `;
  const incomes = db.prepare(listSql).all(...params, limit, offset) as unknown as IncomeRow[];

  if (incomes.length === 0) {
    return `No income entries recorded${total > 0 ? ` (total: ${total})` : ""}.`;
  }

  const currencyCache = new Map<string, CurrencyRow>();
  const getCurrency = (code: string): CurrencyRow => {
    if (!currencyCache.has(code)) {
      currencyCache.set(code, resolveCurrency(code, db));
    }
    return currencyCache.get(code)!;
  };

  let receiptsByIncomeId: Map<string, ReceiptRow[]> | undefined;
  if (includeReceipts) {
    const incomeIds = incomes.map((i) => i.id);
    if (incomeIds.length > 0) {
      const placeholders = incomeIds.map(() => "?").join(",");
      const receiptsSql = `
        SELECT id, income_id, amount, currency, date, notes, created_at FROM (
          SELECT *, ROW_NUMBER() OVER (PARTITION BY income_id ORDER BY date DESC) as rn
          FROM income_receipts
          WHERE income_id IN (${placeholders})
        ) WHERE rn <= 5
        ORDER BY income_id, date DESC
      `;
      const allReceipts = db.prepare(receiptsSql).all(...incomeIds) as unknown as ReceiptRow[];

      receiptsByIncomeId = new Map();
      for (const receipt of allReceipts) {
        const existing = receiptsByIncomeId.get(receipt.income_id) ?? [];
        existing.push(receipt);
        receiptsByIncomeId.set(receipt.income_id, existing);
      }
    }
  }

  const lines: string[] = [];
  lines.push(`📋 Income (${incomes.length}${total > limit ? ` of ${total}` : ""}):`);

  for (const income of incomes) {
    const currency = getCurrency(income.currency);
    const formattedAmount = formatAmount(income.expected_amount, currency);

    const recurrence = income.is_recurring === 1
      ? ` [${income.frequency}${income.interval_days ? ` (every ${income.interval_days} days)` : ""}]`
      : "";

    const nextDate = income.next_expected_receipt_date
      ? ` | Next: ${income.next_expected_receipt_date}`
      : "";

    const status = income.is_active === 1 ? "" : " (INACTIVE)";

    lines.push(
      `- ${income.reason}${recurrence}${status}: ${formattedAmount} (expected: ${income.date})${nextDate}`,
    );
    lines.push(`  ID: ${income.id}`);

    if (includeReceipts && receiptsByIncomeId) {
      const receipts = receiptsByIncomeId.get(income.id);
      if (receipts && receipts.length > 0) {
        for (const receipt of receipts) {
          const recCurrency = getCurrency(receipt.currency);
          const recAmount = formatAmount(receipt.amount, recCurrency);
          const note = receipt.notes ? ` - ${receipt.notes}` : "";
          lines.push(`  └─ Received: ${recAmount} (${receipt.date})${note}`);
        }
      } else {
        lines.push(`  └─ No receipts recorded`);
      }
    }
  }

  if (total > limit + offset) {
    lines.push("");
    lines.push(`💡 More results available. Use offset=${offset + limit} to see more.`);
  } else if (offset > 0 && incomes.length > 0) {
    lines.push("");
    lines.push("ℹ️ End of results.");
  }

  return lines.join("\n");
}
