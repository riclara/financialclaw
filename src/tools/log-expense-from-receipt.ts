import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { getDb } from "../db/database.js";
import {
  formatAmount,
  isPlaceholderCurrency,
  resolveCurrency,
  PLACEHOLDER_CURRENCY,
} from "./helpers/currency-utils.js";
import { todayISO } from "./helpers/date-utils.js";

const ISO_DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

export const InputSchema = Type.Object(
  {
    amount: Type.Number({ minimum: 0.01 }),
    date: Type.String({ pattern: ISO_DATE_PATTERN }),
    merchant: Type.Optional(Type.String()),
    category: Type.Optional(Type.String()),
    currency: Type.Optional(Type.String()),
    raw_text: Type.Optional(Type.String()),
    description: Type.Optional(Type.String()),
    confirm: Type.Optional(Type.Boolean()),
  },
  { additionalProperties: false },
);

export type LogExpenseFromReceiptInput = Static<typeof InputSchema>;

function assertValidInput(input: LogExpenseFromReceiptInput): void {
  if (!Value.Check(InputSchema, input)) {
    throw new Error(
      "Invalid parameters: amount is required and must be greater than 0, date is required in YYYY-MM-DD format.",
    );
  }
  if (input.description !== undefined && input.description.trim().length === 0) {
    throw new Error("description must not be blank.");
  }
  if (input.merchant !== undefined && input.merchant.trim().length === 0) {
    throw new Error("merchant must not be blank.");
  }
  if (input.category !== undefined && input.category.trim().length === 0) {
    throw new Error("category must not be blank.");
  }
  if (input.raw_text !== undefined && input.raw_text.trim().length === 0) {
    throw new Error("raw_text must not be blank.");
  }
}

export function executeLogExpenseFromReceipt(
  input: LogExpenseFromReceiptInput,
  db: DatabaseSync = getDb(),
): string {
  assertValidInput(input);

  const currency = resolveCurrency(input.currency, db);
  const now = new Date().toISOString();

  // Process inputs
  const amount = input.amount;
  const date = input.date;
  const merchant = input.merchant?.trim() ?? null;
  const category = (input.category?.trim() ?? "OTHER").toUpperCase();
  const rawText = input.raw_text?.trim() ?? null;
  const description = input.description?.trim();

  // Determine description if not provided
  const descriptionFinal =
    description ??
    (merchant ? `Expense at ${merchant}` : "OCR expense");

  if (input.confirm !== true) {
    const formattedAmount = formatAmount(amount, currency);
    const merchantLine = merchant ?? "(none)";
    const rawTextLine = rawText ? `${rawText.slice(0, 200)}${rawText.length > 200 ? "…" : ""}` : "(none)";
    return [
      "Preview (nothing saved yet). Show these fields to the user and ask for explicit confirmation before calling this tool again with confirm=true and the same fields:",
      `- Amount: ${formattedAmount}`,
      `- Date: ${date}`,
      `- Merchant: ${merchantLine}`,
      `- Category: ${category}`,
      `- Description: ${descriptionFinal}`,
      `- Raw OCR text: ${rawTextLine}`,
      "",
      "To save, call log_expense_from_receipt again with confirm=true and the exact same amount, date, merchant, category, description, currency, and raw_text.",
    ].join("\n");
  }

  // Generate IDs
  const extractionId = randomUUID();
  const expenseId = randomUUID();

  // Use transaction for atomicity
  db.exec("BEGIN");
  try {
    // Insert into ocr_extractions
    db.prepare(
      `
        INSERT INTO ocr_extractions (
          id, provider, source_path, raw_text, lines_json,
          average_confidence, suggested_amount, suggested_currency,
          suggested_date, suggested_merchant, suggested_category,
          status, failure_code, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      extractionId,
      "openclaw_agent",
      null, // source_path not applicable for agentic OCR
      rawText,
      null, // lines_json not applicable for agentic OCR
      null, // average_confidence not applicable for agentic OCR
      amount,
      currency.code,
      date,
      merchant,
      category,
      "COMPLETED",
      null, // failure_code
      now,
    );

    // Insert into expenses
    db.prepare(
      `
        INSERT INTO expenses (
          id, amount, currency, category, merchant, description,
          due_date, payment_date, status, source,
          ocr_extraction_id, recurring_rule_id, generated_from_rule,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      expenseId,
      amount,
      currency.code,
      category,
      merchant,
      descriptionFinal,
      date,
      date,
      "PAID",
      "OCR",
      extractionId,
      null,
      0,
      1,
      now,
      now,
    );
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  // Format response
  const formattedAmount = formatAmount(amount, currency);
  const merchantPart = merchant ? ` — ${merchant}` : "";
  const categoryPart = category !== "OTHER" ? ` [${category}]` : "";

  let message =
    `OCR expense logged: ${formattedAmount}${categoryPart} · ${descriptionFinal}${merchantPart} · ${date} · Paid (ID: ${expenseId})`;

  if (isPlaceholderCurrency(db)) {
    message +=
      "\n\nHint: you haven't configured a real currency yet. Use manage_currency to add yours and set it as default.";
  }

  return message;
}