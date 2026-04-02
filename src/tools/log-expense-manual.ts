import { randomUUID } from "node:crypto";

import { DatabaseSync } from "node:sqlite";
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
      "Invalid parameters: amount must be greater than 0, description must not be empty, and due_date must be in YYYY-MM-DD format.",
    );
  }
}

export function executeLogExpenseManual(
  input: LogExpenseManualInput,
  db: DatabaseSync = getDb(),
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
  const statusLabel = status === "PAID" ? "paid" : "pending";
  const merchantPart =
    input.merchant != null ? ` — ${input.merchant}` : "";

  let message =
    `Expense logged: ${formattedAmount} · ${input.description}${merchantPart} · ${input.due_date} · ${statusLabel} (ID: ${id})`;

  if (isPlaceholderCurrency(db)) {
    message +=
      "\n\nHint: you haven't configured a real currency yet. Use manage_currency to add yours and set it as default.";
  }

  return message;
}
