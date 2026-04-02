import { DatabaseSync } from "node:sqlite";
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
    throw new Error(`Action ${action} requires the "${fieldName}" field.`);
  }

  return normalized;
}

function normalizeCode(code: string | undefined, action: string): string {
  return requireText(code, "code", action).toUpperCase();
}

function addCurrency(input: ManageCurrencyInput, db: DatabaseSync): string {
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
    throw new Error(`Currency ${code} already exists. Use a different code or choose set_default.`);
  }

  db.prepare(
    `
      INSERT INTO currencies (code, name, symbol, is_default)
      VALUES (?, ?, ?, 0)
    `,
  ).run(code, name, symbol);

  return `Currency ${code} added successfully.`;
}

function listCurrencies(db: DatabaseSync): string {
  const currencies = db
    .prepare(
      `
        SELECT code, name, symbol, is_default
        FROM currencies
        ORDER BY is_default DESC, created_at ASC, code ASC
      `,
    )
    .all() as unknown as CurrencyRow[];

  if (currencies.length === 0) {
    return "No currencies registered.";
  }

  const lines = currencies.map((currency) => {
    const prefix = currency.is_default === 1 ? "*" : "-";
    const suffix = currency.is_default === 1 ? " [default]" : "";
    return `${prefix} ${currency.code} - ${currency.name} (${currency.symbol})${suffix}`;
  });

  return ["Registered currencies:", ...lines].join("\n");
}

function setDefaultCurrency(input: ManageCurrencyInput, db: DatabaseSync): string {
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
    throw new Error(`No registered currency found with code ${code}.`);
  }

  db.exec("BEGIN");
  try {
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
    ).run(code);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return `Currency ${code} set as default.`;
}

export function executeManageCurrency(
  input: ManageCurrencyInput,
  db: DatabaseSync = getDb(),
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
      throw new Error(`Unsupported action: ${exhaustiveCheck}`);
    }
  }
}
