import { randomUUID } from "node:crypto";

import { DatabaseSync } from "node:sqlite";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { getDb } from "../db/database.js";
import { computeNextDate } from "./helpers/date-utils.js";
import {
  formatAmount,
  isPlaceholderCurrency,
  resolveCurrency,
} from "./helpers/currency-utils.js";

const ISO_DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

function isValidCalendarDate(dateStr: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (match === null) return false;
  const year = Number.parseInt(match[1], 10);
  const month = Number.parseInt(match[2], 10);
  const day = Number.parseInt(match[3], 10);
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

export const InputSchema = Type.Object(
  {
    reason: Type.String({ minLength: 1 }),
    expected_amount: Type.Number({ minimum: 0 }),
    currency: Type.Optional(Type.String()),
    date: Type.String({ pattern: ISO_DATE_PATTERN }),
    recurring: Type.Optional(Type.Boolean()),
    frequency: Type.Optional(
      Type.Union([
        Type.Literal("WEEKLY"),
        Type.Literal("BIWEEKLY"),
        Type.Literal("MONTHLY"),
        Type.Literal("INTERVAL_DAYS"),
      ]),
    ),
    interval_days: Type.Optional(Type.Integer({ minimum: 1 })),
  },
  { additionalProperties: false },
);

export type LogIncomeInput = Static<typeof InputSchema>;

export function executeLogIncome(
  input: LogIncomeInput,
  db: DatabaseSync = getDb(),
): string {
  if (!Value.Check(InputSchema, input)) {
    throw new Error(
      "Parámetros inválidos: reason no puede estar vacío, expected_amount debe ser mayor o igual a 0, y date debe tener formato YYYY-MM-DD.",
    );
  }

  const trimmedReason = input.reason.trim();
  if (trimmedReason.length === 0) {
    throw new Error("El campo reason no puede estar vacío o contener solo espacios.");
  }

  if (!isValidCalendarDate(input.date)) {
    throw new Error(`La fecha "${input.date}" no es una fecha válida en el calendario.`);
  }

  const isRecurring = input.recurring ?? false;

  if (isRecurring && !input.frequency) {
    throw new Error(
      "El campo frequency es obligatorio para ingresos recurrentes.",
    );
  }

  if (input.frequency === "INTERVAL_DAYS" && !input.interval_days) {
    throw new Error(
      "El campo interval_days es obligatorio cuando frequency es INTERVAL_DAYS.",
    );
  }

  const currency = resolveCurrency(input.currency, db);

  const nextDate =
    isRecurring && input.frequency
      ? computeNextDate(input.date, input.frequency, input.interval_days ?? 0)
      : null;

  const now = new Date().toISOString();
  const incomeId = randomUUID();
  const receiptId = randomUUID();

  db.exec("BEGIN");
  try {
    db.prepare(
      `
        INSERT INTO incomes (
          id,
          reason,
          expected_amount,
          currency,
          date,
          frequency,
          interval_days,
          is_recurring,
          next_expected_receipt_date,
          is_active,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      incomeId,
      trimmedReason,
      input.expected_amount,
      currency.code,
      input.date,
      input.frequency ?? null,
      input.interval_days ?? null,
      isRecurring ? 1 : 0,
      nextDate,
      1,
      now,
    );

    db.prepare(
      `
        INSERT INTO income_receipts (
          id,
          income_id,
          amount,
          currency,
          date,
          notes,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
    ).run(
      receiptId,
      incomeId,
      input.expected_amount,
      currency.code,
      input.date,
      null,
      now,
    );
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  const formattedAmount = formatAmount(input.expected_amount, currency);
  let message = `Ingreso registrado: ${formattedAmount} · ${trimmedReason} · ${input.date} (ID: ${incomeId})`;

  if (nextDate !== null) {
    message += `\nPróxima recepción esperada: ${nextDate}`;
  }

  if (isPlaceholderCurrency(db)) {
    message +=
      "\n\nSugerencia: aún no has configurado una moneda real. Usa manage_currency para agregar la tuya y establecerla como moneda por defecto.";
  }

  return message;
}
