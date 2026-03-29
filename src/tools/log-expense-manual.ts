import { randomUUID } from "node:crypto";

import Database from "better-sqlite3";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { getDb } from "../db/database.js";
import { todayISO } from "./helpers/date-utils.js";
import {
  formatAmount,
  isPlaceholderCurrency,
  resolveCurrency,
} from "./helpers/currency-utils.js";

const ISO_DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

export const InputSchema = Type.Object(
  {
    amount: Type.Number({ exclusiveMinimum: 0 }),
    description: Type.String({ minLength: 1 }),
    due_date: Type.String({ pattern: ISO_DATE_PATTERN }),
    category: Type.Optional(Type.String()),
    currency: Type.Optional(Type.String()),
    merchant: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type LogExpenseManualInput = Static<typeof InputSchema>;

function assertValidInput(input: LogExpenseManualInput): void {
  if (!Value.Check(InputSchema, input)) {
    throw new Error(
      "Parámetros inválidos: amount debe ser mayor que 0, description no puede estar vacío, y due_date debe tener formato YYYY-MM-DD.",
    );
  }
}

export function executeLogExpenseManual(
  input: LogExpenseManualInput,
  db: Database.Database = getDb(),
): string {
  assertValidInput(input);

  const currency = resolveCurrency(input.currency, db);
  const category = input.category?.trim() || "OTHER";
  const today = todayISO();
  const isPaid = input.due_date <= today;
  const status = isPaid ? "PAID" : "PENDING";
  const paymentDate = isPaid ? input.due_date : null;

  const now = new Date().toISOString();
  const id = randomUUID();

  db.prepare(
    `
      INSERT INTO expenses (
        id,
        amount,
        currency,
        category,
        merchant,
        description,
        due_date,
        payment_date,
        status,
        source,
        ocr_extraction_id,
        recurring_rule_id,
        generated_from_rule,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    id,
    input.amount,
    currency.code,
    category,
    input.merchant ?? null,
    input.description,
    input.due_date,
    paymentDate,
    status,
    "MANUAL",
    null,
    null,
    0,
    1,
    now,
    now,
  );

  const formattedAmount = formatAmount(input.amount, currency);
  const statusLabel = status === "PAID" ? "pagado" : "pendiente";
  const merchantPart =
    input.merchant != null ? ` — ${input.merchant}` : "";

  let message =
    `Gasto registrado: ${formattedAmount} · ${input.description}${merchantPart} · ${input.due_date} · ${statusLabel} (ID: ${id})`;

  if (isPlaceholderCurrency(db)) {
    message +=
      "\n\nSugerencia: aún no has configurado una moneda real. Usa manage_currency para agregar la tuya y establecerla como moneda por defecto.";
  }

  return message;
}
