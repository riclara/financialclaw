import { DatabaseSync } from "node:sqlite";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { getDb } from "../db/database.js";
import { resolvePeriodRange, todayISO } from "./helpers/date-utils.js";
import { resolveCurrency, formatAmount, CurrencyRow } from "./helpers/currency-utils.js";

export const InputSchema = Type.Object({
  period: Type.Optional(Type.Union([
    Type.Literal("this_month"),
    Type.Literal("last_month"),
    Type.Literal("last_30_days"),
    Type.Literal("this_year"),
    Type.Literal("all"),
  ])),
  start_date: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  end_date: Type.Optional(Type.String({ pattern: "^\\d{4}-\\d{2}-\\d{2}$" })),
  category: Type.Optional(Type.String()),
  status: Type.Optional(Type.Union([
    Type.Literal("PENDING"),
    Type.Literal("PAID"),
    Type.Literal("OVERDUE"),
  ])),
  search: Type.Optional(Type.String()),
  currency: Type.Optional(Type.String()),
  source: Type.Optional(Type.Union([
    Type.Literal("MANUAL"),
    Type.Literal("OCR"),
  ])),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
  offset: Type.Optional(Type.Integer({ minimum: 0 })),
}, { additionalProperties: false });

export type Input = Static<typeof InputSchema>;

function assertValidInput(input: Input): void {
  if (!Value.Check(InputSchema, input)) {
    throw new Error(
      "Parámetros inválidos: verifica los tipos de period, status, source, limit, offset y el formato de fechas (YYYY-MM-DD).",
    );
  }
}

interface ExpenseRow {
  id: string;
  amount: number;
  currency: string;
  category: string | null;
  merchant: string | null;
  description: string;
  due_date: string;
  payment_date: string | null;
  status: string;
  source: string;
  created_at: string;
}

function validateDateRange(startDate?: string, endDate?: string): void {
  if (startDate !== undefined && endDate === undefined) {
    throw new Error("Si proporcionas start_date, también debes proporcionar end_date.");
  }
  if (startDate === undefined && endDate !== undefined) {
    throw new Error("Si proporcionas end_date, también debes proporcionar start_date.");
  }
  if (startDate !== undefined && endDate !== undefined) {
    if (startDate > endDate) {
      throw new Error("start_date no puede ser mayor que end_date.");
    }
  }
}

export function executeListExpenses(input: Input, db: DatabaseSync = getDb()): string {
  assertValidInput(input);

  const limit = input.limit ?? 20;
  const offset = input.offset ?? 0;

  validateDateRange(input.start_date, input.end_date);

  let dateRange = null;
  if (input.start_date && input.end_date) {
    dateRange = { start: input.start_date, end: input.end_date };
  } else if (input.period) {
    dateRange = resolvePeriodRange(input.period);
  } else {
    dateRange = resolvePeriodRange("this_month");
  }

  const currencyRow: CurrencyRow | null = input.currency
    ? resolveCurrency(input.currency, db)
    : null;

  const params: (string | number | null | bigint | Uint8Array)[] = [];
  const conditions: string[] = ["is_active = 1"];

  if (dateRange) {
    conditions.push("due_date >= ? AND due_date <= ?");
    params.push(dateRange.start, dateRange.end);
  }

  if (input.category) {
    conditions.push("category = ?");
    params.push(input.category.toUpperCase());
  }

  if (input.status) {
    conditions.push("status = ?");
    params.push(input.status);
  }

  if (input.search) {
    const searchTerm = `%${input.search}%`;
    conditions.push("(description LIKE ? OR merchant LIKE ?)");
    params.push(searchTerm, searchTerm);
  }

  if (currencyRow) {
    conditions.push("currency = ?");
    params.push(currencyRow.code);
  }

  if (input.source) {
    conditions.push("source = ?");
    params.push(input.source);
  }

  const whereClause = conditions.join(" AND ");

  const countSql = `SELECT COUNT(*) as total FROM expenses WHERE ${whereClause}`;
  const countResult = db.prepare(countSql).get(...params) as unknown as { total: number };
  const total = countResult.total;

  const orderClause = "ORDER BY due_date DESC";
  const paginatedParams = [...params, limit, offset];
  const sql = `SELECT id, amount, currency, category, merchant, description,
    due_date, payment_date, status, source, created_at
  FROM expenses
  WHERE ${whereClause}
  ${orderClause}
  LIMIT ? OFFSET ?`;

  const rows = db.prepare(sql).all(...paginatedParams) as unknown as ExpenseRow[];

  if (rows.length === 0) {
    const hint = total === 0
      ? "No hay gastos registrados."
      : `No hay gastos en la página solicitada (total: ${total}).`;
    return `${hint}\n\nUsa filtros diferentes o cambia el offset.`;
  }

  const currencyCache = new Map<string, CurrencyRow>();

  function getCurrencyRow(code: string): CurrencyRow {
    if (!currencyCache.has(code)) {
      currencyCache.set(code, resolveCurrency(code, db));
    }
    return currencyCache.get(code)!;
  }

  const lines: string[] = [
    `📋 Gastos (${rows.length} de ${total} total)`,
    "",
  ];

  for (const row of rows) {
    const curr = getCurrencyRow(row.currency);
    const formattedAmount = formatAmount(row.amount, curr, db);
    const date = row.due_date;
    const category = row.category || "SIN_CATEGORÍA";
    const merchant = row.merchant ? ` - ${row.merchant}` : "";
    const statusIcon = row.status === "PAID" ? "✓" : row.status === "OVERDUE" ? "⚠" : "○";
    const sourceTag = row.source === "OCR" ? " [OCR]" : "";

    lines.push(
      `${date} ${statusIcon} ${formattedAmount}${sourceTag}`,
      `   ${row.description}${merchant}`,
      `   ${category} • ${row.status}`,
      `   ID: ${row.id}`,
      "",
    );
  }

  if (total > limit + offset) {
    const nextOffset = offset + limit;
    lines.push(`→ Hay más resultados. Usa offset=${nextOffset} para ver la siguiente página.`);
  } else if (offset > 0) {
    lines.push("← Fin de los resultados.");
  }

  return lines.join("\n");
}
