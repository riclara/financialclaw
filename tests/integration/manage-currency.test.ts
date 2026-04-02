import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeManageCurrency } from "../../src/tools/manage-currency.js";
import { createTestDb } from "../helpers/test-db.js";

interface CurrencyRow {
  code: string;
  name: string;
  symbol: string;
  is_default: number;
}

describe("manage_currency", () => {
  it("agrega una moneda nueva y persiste el código en mayúsculas", () => {
    const db = createTestDb();

    const result = executeManageCurrency(
      {
        action: "add",
        code: "usd",
        name: "Dólar estadounidense",
        symbol: "$",
      },
      db,
    );

    assert.equal(result, "Moneda USD agregada correctamente.");

    const row = db
      .prepare(
        `
          SELECT code, name, symbol, is_default
          FROM currencies
          WHERE code = 'USD'
        `,
      )
      .get() as CurrencyRow | undefined;

    assert.deepEqual({ ...row }, {
      code: "USD",
      name: "Dólar estadounidense",
      symbol: "$",
      is_default: 0,
    });
  });

  it("falla al intentar agregar una moneda duplicada", () => {
    const db = createTestDb();

    executeManageCurrency(
      {
        action: "add",
        code: "usd",
        name: "Dólar estadounidense",
        symbol: "$",
      },
      db,
    );

    assert.throws(
      () =>
        executeManageCurrency(
          {
            action: "add",
            code: "USD",
            name: "Otra moneda",
            symbol: "US$",
          },
          db,
        ),
      /La moneda USD ya existe\./,
    );
  });

  it("lista la placeholder y las monedas agregadas dejando la default primero", () => {
    const db = createTestDb();

    executeManageCurrency(
      {
        action: "add",
        code: "usd",
        name: "Dólar estadounidense",
        symbol: "$",
      },
      db,
    );

    executeManageCurrency(
      {
        action: "add",
        code: "eur",
        name: "Euro",
        symbol: "€",
      },
      db,
    );

    const result = executeManageCurrency({ action: "list" }, db);
    const lines = result.split("\n");

    assert.equal(lines[0], "Monedas registradas:");
    assert.equal(lines[1], "* XXX - Sin configurar (¤) [default]");
    assert.ok(lines.includes("- USD - Dólar estadounidense ($)"));
    assert.ok(lines.includes("- EUR - Euro (€)"));
  });

  it("cambia la moneda por defecto y deja exactamente una activa", () => {
    const db = createTestDb();

    executeManageCurrency(
      {
        action: "add",
        code: "usd",
        name: "Dólar estadounidense",
        symbol: "$",
      },
      db,
    );

    const result = executeManageCurrency(
      {
        action: "set_default",
        code: "usd",
      },
      db,
    );

    assert.equal(result, "La moneda USD quedó configurada como moneda por defecto.");

    const currencies = db
      .prepare(
        `
          SELECT code, is_default
          FROM currencies
          ORDER BY code ASC
        `,
      )
      .all() as Array<Pick<CurrencyRow, "code" | "is_default">>;

    assert.equal(currencies.filter((currency) => currency.is_default === 1).length, 1);
    assert.equal(currencies.find((currency) => currency.code === "USD")?.is_default, 1);
    assert.equal(currencies.find((currency) => currency.code === "XXX")?.is_default, 0);
  });

  it("falla al intentar marcar como default una moneda inexistente", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeManageCurrency(
          {
            action: "set_default",
            code: "USD",
          },
          db,
        ),
      /No existe una moneda registrada con el código USD\./,
    );
  });
});
