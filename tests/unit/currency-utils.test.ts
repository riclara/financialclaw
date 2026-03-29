import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  formatAmount,
  isPlaceholderCurrency,
  PLACEHOLDER_CURRENCY,
  resolveCurrency,
} from "../../src/tools/helpers/currency-utils.js";
import { createTestDb } from "../helpers/test-db.js";

describe("currency-utils", () => {
  it("retorna la moneda default del seed cuando no recibe código", () => {
    const db = createTestDb();

    assert.deepEqual(resolveCurrency(undefined, db), {
      code: PLACEHOLDER_CURRENCY,
      name: "Sin configurar",
      symbol: "¤",
      is_default: 1,
    });
  });

  it("resuelve una moneda registrada y falla con una inexistente", () => {
    const db = createTestDb();

    db.prepare(
      `
        INSERT INTO currencies (code, name, symbol, is_default)
        VALUES (?, ?, ?, 0)
      `,
    ).run("USD", "Dólar estadounidense", "US$");

    assert.deepEqual(resolveCurrency("usd", db), {
      code: "USD",
      name: "Dólar estadounidense",
      symbol: "US$",
      is_default: 0,
    });

    assert.throws(
      () => resolveCurrency("EUR", db),
      /La moneda EUR no está registrada\./,
    );
  });

  it("detecta la transición de moneda placeholder a una real configurada como default", () => {
    const db = createTestDb();

    assert.equal(isPlaceholderCurrency(db), true);

    db.prepare(
      `
        INSERT INTO currencies (code, name, symbol, is_default)
        VALUES (?, ?, ?, 1)
      `,
    ).run("USD", "Dólar estadounidense", "US$");

    db.prepare("UPDATE currencies SET is_default = 0 WHERE code = ?").run(PLACEHOLDER_CURRENCY);

    assert.equal(isPlaceholderCurrency(db), false);
  });

  it("formatea montos con símbolo, separadores y código de moneda", () => {
    assert.equal(
      formatAmount(54900, {
        code: "COP",
        name: "Peso colombiano",
        symbol: "$",
      }),
      "$54.900 COP",
    );
    assert.equal(
      formatAmount(0, {
        code: PLACEHOLDER_CURRENCY,
        name: "Sin configurar",
        symbol: "¤",
      }),
      "¤0 XXX",
    );
  });
});
