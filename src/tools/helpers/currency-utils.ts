import { getDb } from "../../db/database.js";

export const PLACEHOLDER_CURRENCY = "XXX";

interface StatementLike {
  get(...params: unknown[]): unknown;
}

interface DbLike {
  prepare(sql: string): StatementLike;
}

export interface CurrencyRow {
  code: string;
  name: string;
  symbol: string;
  is_default?: number;
}

function getDefaultCurrency(db: DbLike): CurrencyRow {
  const currency = db
    .prepare(
      `
        SELECT code, name, symbol, is_default
        FROM currencies
        WHERE is_default = 1
        ORDER BY created_at ASC
        LIMIT 1
      `,
    )
    .get() as CurrencyRow | undefined;

  if (currency === undefined) {
    throw new Error("No hay una moneda por defecto configurada.");
  }

  return currency;
}

export function resolveCurrency(
  inputCode?: string,
  db: DbLike = getDb(),
): CurrencyRow {
  const normalizedCode = inputCode?.trim().toUpperCase();

  if (normalizedCode === undefined || normalizedCode === "") {
    return getDefaultCurrency(db);
  }

  const currency = db
    .prepare(
      `
        SELECT code, name, symbol, is_default
        FROM currencies
        WHERE code = ?
        LIMIT 1
      `,
    )
    .get(normalizedCode) as CurrencyRow | undefined;

  if (currency === undefined) {
    throw new Error(
      `La moneda ${normalizedCode} no está registrada. Usa manage_currency para agregarla primero.`,
    );
  }

  return currency;
}

export function isPlaceholderCurrency(db: DbLike = getDb()): boolean {
  return resolveCurrency(undefined, db).code === PLACEHOLDER_CURRENCY;
}

export function formatAmount(amount: number, currency: CurrencyRow, _db?: DbLike): string {
  const sign = amount < 0 ? "-" : "";
  const absoluteAmount = Math.abs(amount);
  const formattedNumber = absoluteAmount.toLocaleString("es-CO", {
    minimumFractionDigits: 0,
    maximumFractionDigits: Number.isInteger(absoluteAmount) ? 0 : 2,
  });

  return `${sign}${currency.symbol}${formattedNumber} ${currency.code}`;
}
