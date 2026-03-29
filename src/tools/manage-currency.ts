import Database from "better-sqlite3";
import { type Static, Type } from "@sinclair/typebox";

import { getDb } from "../db/database.js";

const ACTIONS = ["add", "list", "set_default"] as const;

interface CurrencyRow {
  code: string;
  name: string;
  symbol: string;
  is_default: number;
}

export const InputSchema = Type.Object(
  {
    action: Type.Union(ACTIONS.map((action) => Type.Literal(action))),
    code: Type.Optional(Type.String()),
    name: Type.Optional(Type.String()),
    symbol: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);

export type ManageCurrencyInput = Static<typeof InputSchema>;

function requireText(value: string | undefined, fieldName: string, action: string): string {
  const normalized = value?.trim();

  if (normalized === undefined || normalized === "") {
    throw new Error(`La acción ${action} requiere el campo "${fieldName}".`);
  }

  return normalized;
}

function normalizeCode(code: string | undefined, action: string): string {
  return requireText(code, "code", action).toUpperCase();
}

function addCurrency(input: ManageCurrencyInput, db: Database.Database): string {
  const code = normalizeCode(input.code, "add");
  const name = requireText(input.name, "name", "add");
  const symbol = requireText(input.symbol, "symbol", "add");

  const existingCurrency = db
    .prepare(
      `
        SELECT code
        FROM currencies
        WHERE code = ?
        LIMIT 1
      `,
    )
    .get(code) as Pick<CurrencyRow, "code"> | undefined;

  if (existingCurrency !== undefined) {
    throw new Error(`La moneda ${code} ya existe. Usa otro código o elige set_default.`);
  }

  db.prepare(
    `
      INSERT INTO currencies (code, name, symbol, is_default)
      VALUES (?, ?, ?, 0)
    `,
  ).run(code, name, symbol);

  return `Moneda ${code} agregada correctamente.`;
}

function listCurrencies(db: Database.Database): string {
  const currencies = db
    .prepare(
      `
        SELECT code, name, symbol, is_default
        FROM currencies
        ORDER BY is_default DESC, created_at ASC, code ASC
      `,
    )
    .all() as CurrencyRow[];

  if (currencies.length === 0) {
    return "No hay monedas registradas.";
  }

  const lines = currencies.map((currency) => {
    const prefix = currency.is_default === 1 ? "*" : "-";
    const suffix = currency.is_default === 1 ? " [default]" : "";
    return `${prefix} ${currency.code} - ${currency.name} (${currency.symbol})${suffix}`;
  });

  return ["Monedas registradas:", ...lines].join("\n");
}

function setDefaultCurrency(input: ManageCurrencyInput, db: Database.Database): string {
  const code = normalizeCode(input.code, "set_default");

  const existingCurrency = db
    .prepare(
      `
        SELECT code
        FROM currencies
        WHERE code = ?
        LIMIT 1
      `,
    )
    .get(code) as Pick<CurrencyRow, "code"> | undefined;

  if (existingCurrency === undefined) {
    throw new Error(`No existe una moneda registrada con el código ${code}.`);
  }

  const changeDefault = db.transaction((currencyCode: string) => {
    db.prepare(
      `
        UPDATE currencies
        SET is_default = 0
      `,
    ).run();

    db.prepare(
      `
        UPDATE currencies
        SET is_default = 1
        WHERE code = ?
      `,
    ).run(currencyCode);
  });

  changeDefault(code);

  return `La moneda ${code} quedó configurada como moneda por defecto.`;
}

export function executeManageCurrency(
  input: ManageCurrencyInput,
  db: Database.Database = getDb(),
): string {
  switch (input.action) {
    case "add":
      return addCurrency(input, db);
    case "list":
      return listCurrencies(db);
    case "set_default":
      return setDefaultCurrency(input, db);
    default: {
      const exhaustiveCheck: never = input.action;
      throw new Error(`Acción no soportada: ${exhaustiveCheck}`);
    }
  }
}
