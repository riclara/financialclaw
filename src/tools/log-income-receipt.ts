import { randomUUID } from "node:crypto";

import Database from "better-sqlite3";
import { type Static, Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { getDb } from "../db/database.js";
import { computeNextDate } from "./helpers/date-utils.js";
import {
  formatAmount,
  PLACEHOLDER_CURRENCY,
  resolveCurrency,
  type CurrencyRow,
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
    income_id: Type.String({ minLength: 1 }),
    received_amount: Type.Number({ minimum: 0 }),
    currency: Type.Optional(Type.String()),
    received_on: Type.String({ pattern: ISO_DATE_PATTERN }),
    note: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type LogIncomeReceiptInput = Static<typeof InputSchema>;

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
}

export function executeLogIncomeReceipt(
  input: LogIncomeReceiptInput,
  db: Database.Database = getDb(),
): string {
  if (!Value.Check(InputSchema, input)) {
    throw new Error(
      "Parámetros inválidos: income_id no puede estar vacío, received_amount debe ser >= 0, y received_on debe tener formato YYYY-MM-DD.",
    );
  }

  if (!isValidCalendarDate(input.received_on)) {
    throw new Error(`La fecha "${input.received_on}" no es una fecha válida en el calendario.`);
  }

  // 1. Look up income by income_id
  const income = db
    .prepare(
      `SELECT id, reason, expected_amount, currency, date, frequency, interval_days, is_recurring, next_expected_receipt_date
       FROM incomes WHERE id = ?`,
    )
    .get(input.income_id) as IncomeRow | undefined;

  if (income === undefined) {
    throw new Error(`El ingreso con ID "${input.income_id}" no existe.`);
  }

  // 2. Resolve effective currency
  let currency: CurrencyRow;
  const trimmedCurrency = input.currency?.trim();
  if (trimmedCurrency) {
    // Validate explicitly provided currency (ignore if whitespace-only)
    currency = resolveCurrency(trimmedCurrency, db);
  } else {
    // Use the currency stored on the income (not the global default)
    const incomeCurrency = db
      .prepare(
        `SELECT code, name, symbol, is_default FROM currencies WHERE code = ?`,
      )
      .get(income.currency) as CurrencyRow | undefined;

    if (incomeCurrency === undefined) {
      throw new Error(
        `La moneda del ingreso (${income.currency}) no está registrada en la base de datos.`,
      );
    }
    currency = incomeCurrency;
  }

  // 3. Compute next date if income is recurring
  const isRecurring = income.is_recurring === 1;
  let nextDate: string | null = null;
  if (isRecurring && income.frequency) {
    nextDate = computeNextDate(
      input.received_on,
      income.frequency,
      income.interval_days ?? 0,
    );
  }

  // 4. Insert receipt and update income (atomic)
  const receiptId = randomUUID();
  const now = new Date().toISOString();

  db.transaction(() => {
    db.prepare(
      `INSERT INTO income_receipts (id, income_id, amount, currency, date, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      receiptId,
      input.income_id,
      input.received_amount,
      currency.code,
      input.received_on,
      input.note ?? null,
      now,
    );

    if (isRecurring && nextDate !== null) {
      db.prepare(
        `UPDATE incomes SET next_expected_receipt_date = ? WHERE id = ?`,
      ).run(nextDate, input.income_id);
    }
  })();

  // 5. Format response
  const formattedReceived = formatAmount(input.received_amount, currency);
  let message = `Recepción registrada: ${formattedReceived} · ${income.reason} · ${input.received_on} (ID: ${receiptId})`;

  // Difference vs expected_amount
  const diff = input.received_amount - income.expected_amount;
  if (diff !== 0) {
    const formattedDiff = formatAmount(Math.abs(diff), currency);
    if (diff > 0) {
      message += `\nDiferencia: +${formattedDiff} sobre el monto esperado.`;
    } else {
      message += `\nDiferencia: -${formattedDiff} por debajo del monto esperado.`;
    }
  }

  if (nextDate !== null) {
    message += `\nPróxima recepción esperada: ${nextDate}`;
  }

  if (currency.code === PLACEHOLDER_CURRENCY) {
    message +=
      "\n\nSugerencia: aún no has configurado una moneda real. Usa manage_currency para agregar la tuya y establecerla como moneda por defecto.";
  }

  return message;
}
