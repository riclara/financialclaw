import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createTestDb } from "../helpers/test-db.js";
import { executeLogIncome } from "../../src/tools/log-income.js";
import { executeLogIncomeReceipt } from "../../src/tools/log-income-receipt.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function insertCop(db: ReturnType<typeof createTestDb>): void {
  db.prepare(
    `INSERT OR IGNORE INTO currencies (code, name, symbol, is_default) VALUES ('COP', 'Peso colombiano', '$', 0)`,
  ).run();
}

function insertEur(db: ReturnType<typeof createTestDb>): void {
  db.prepare(
    `INSERT OR IGNORE INTO currencies (code, name, symbol, is_default) VALUES ('EUR', 'Euro', '€', 0)`,
  ).run();
}

function setDefault(db: ReturnType<typeof createTestDb>, code: string): void {
  db.prepare(`UPDATE currencies SET is_default = 0`).run();
  db.prepare(`UPDATE currencies SET is_default = 1 WHERE code = ?`).run(code);
}

function createIncome(
  db: ReturnType<typeof createTestDb>,
  overrides: Partial<{
    reason: string;
    expected_amount: number;
    currency: string;
    date: string;
    recurring: boolean;
    frequency: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "INTERVAL_DAYS";
    interval_days: number;
  }> = {},
): string {
  const params = {
    reason: "Salario",
    expected_amount: 1_000_000,
    date: "2026-01-01",
    ...overrides,
  };

  const msg = executeLogIncome(params, db);
  const match = /\(ID: ([^)]+)\)/.exec(msg);
  if (!match) throw new Error("No se encontró el ID del ingreso en la respuesta");
  return match[1];
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("log-income-receipt — integración", () => {
  // ── receipt exitoso para income existente ─────────────────────────────────

  it("registra receipt para income existente", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const incomeId = createIncome(db, { currency: "COP" });
    const result = executeLogIncomeReceipt(
      { income_id: incomeId, received_amount: 1_000_000, received_on: "2026-01-05" },
      db,
    );

    assert.ok(result.includes("Recepción registrada"), result);
    assert.ok(result.includes("Salario"), result);
    assert.ok(result.includes("2026-01-05"), result);

    const receipt = db
      .prepare(
        `SELECT amount, date, currency FROM income_receipts WHERE income_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(incomeId) as { amount: number; date: string; currency: string } | undefined;

    assert.ok(receipt !== undefined);
    assert.equal(receipt.amount, 1_000_000);
    assert.equal(receipt.date, "2026-01-05");
    assert.equal(receipt.currency, "COP");
  });

  // ── error por income_id inexistente ───────────────────────────────────────

  it("lanza error si income_id no existe", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeLogIncomeReceipt(
          { income_id: "id-inexistente", received_amount: 500, received_on: "2026-01-05" },
          db,
        ),
      /no existe/i,
    );
  });

  // ── income recurrente actualiza próxima fecha ─────────────────────────────

  it("income recurrente MONTHLY actualiza next_expected_receipt_date", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const incomeId = createIncome(db, {
      currency: "COP",
      recurring: true,
      frequency: "MONTHLY",
    });

    const result = executeLogIncomeReceipt(
      { income_id: incomeId, received_amount: 1_000_000, received_on: "2026-01-05" },
      db,
    );

    assert.ok(result.includes("Próxima recepción esperada: 2026-02-05"), result);

    const income = db
      .prepare(`SELECT next_expected_receipt_date FROM incomes WHERE id = ?`)
      .get(incomeId) as { next_expected_receipt_date: string };

    assert.equal(income.next_expected_receipt_date, "2026-02-05");
  });

  // ── income no recurrente no actualiza próxima fecha ───────────────────────

  it("income no recurrente NO actualiza next_expected_receipt_date", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const incomeId = createIncome(db, { currency: "COP" });

    const beforeRow = db
      .prepare(`SELECT next_expected_receipt_date FROM incomes WHERE id = ?`)
      .get(incomeId) as { next_expected_receipt_date: string | null };

    executeLogIncomeReceipt(
      { income_id: incomeId, received_amount: 1_000_000, received_on: "2026-01-05" },
      db,
    );

    const afterRow = db
      .prepare(`SELECT next_expected_receipt_date FROM incomes WHERE id = ?`)
      .get(incomeId) as { next_expected_receipt_date: string | null };

    assert.equal(afterRow.next_expected_receipt_date, beforeRow.next_expected_receipt_date);
  });

  // ── diferencia positiva en la respuesta ───────────────────────────────────

  it("incluye diferencia positiva cuando received_amount > expected_amount", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const incomeId = createIncome(db, { currency: "COP", expected_amount: 1_000_000 });

    const result = executeLogIncomeReceipt(
      { income_id: incomeId, received_amount: 1_200_000, received_on: "2026-01-05" },
      db,
    );

    assert.ok(result.includes("Diferencia: +"), `esperaba '+' en: ${result}`);
    assert.ok(result.includes("sobre el monto esperado"), result);
  });

  // ── diferencia negativa en la respuesta ───────────────────────────────────

  it("incluye diferencia negativa cuando received_amount < expected_amount", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const incomeId = createIncome(db, { currency: "COP", expected_amount: 1_000_000 });

    const result = executeLogIncomeReceipt(
      { income_id: incomeId, received_amount: 800_000, received_on: "2026-01-05" },
      db,
    );

    assert.ok(result.includes("Diferencia: -"), `esperaba '-' en: ${result}`);
    assert.ok(result.includes("por debajo del monto esperado"), result);
  });

  // ── currency omitida => usa la del income ─────────────────────────────────

  it("usa la moneda del income cuando currency no se proporciona", () => {
    const db = createTestDb();
    insertCop(db);
    insertEur(db);
    // La moneda default sigue siendo XXX; el income tiene EUR explícito

    const incomeId = createIncome(db, { currency: "EUR" });

    executeLogIncomeReceipt(
      { income_id: incomeId, received_amount: 500, received_on: "2026-01-05" },
      db,
    );

    const receipt = db
      .prepare(
        `SELECT currency FROM income_receipts WHERE income_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(incomeId) as { currency: string };

    assert.equal(receipt.currency, "EUR");
  });

  // ── currency explícita no registrada => error descriptivo ─────────────────

  it("lanza error descriptivo si currency explícita no está registrada", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const incomeId = createIncome(db, { currency: "COP" });

    assert.throws(
      () =>
        executeLogIncomeReceipt(
          {
            income_id: incomeId,
            received_amount: 1_000_000,
            received_on: "2026-01-05",
            currency: "JPY",
          },
          db,
        ),
      /JPY.*no está registrada|no está registrada.*JPY/i,
    );
  });

  // ── respuesta sugiere manage_currency cuando moneda efectiva es XXX ────────

  it("sugiere configurar moneda cuando la moneda efectiva es XXX", () => {
    const db = createTestDb();
    // XXX es la moneda default del seed; crear income sin especificar currency -> usa XXX

    const incomeId = createIncome(db); // currency = XXX por defecto

    const result = executeLogIncomeReceipt(
      { income_id: incomeId, received_amount: 200, received_on: "2026-01-05" },
      db,
    );

    assert.ok(result.includes("manage_currency"), `esperaba sugerencia en: ${result}`);
  });

  // ── [P2] fecha calendario inválida en received_on ─────────────────────────

  it("lanza error si received_on tiene formato correcto pero fecha imposible", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const incomeId = createIncome(db, { currency: "COP" });

    assert.throws(
      () =>
        executeLogIncomeReceipt(
          { income_id: incomeId, received_amount: 1_000_000, received_on: "2026-02-30" },
          db,
        ),
      /no es una fecha válida/i,
    );
  });

  // ── [P2] currency en blanco (solo espacios) usa la moneda del income ───────

  it("currency con solo espacios usa la moneda del income, no la default global", () => {
    const db = createTestDb();
    insertCop(db);
    insertEur(db);
    // default global = XXX; income tiene EUR explícito

    const incomeId = createIncome(db, { currency: "EUR" });

    executeLogIncomeReceipt(
      { income_id: incomeId, received_amount: 500, received_on: "2026-01-05", currency: "   " },
      db,
    );

    const receipt = db
      .prepare(
        `SELECT currency FROM income_receipts WHERE income_id = ? ORDER BY created_at DESC LIMIT 1`,
      )
      .get(incomeId) as { currency: string };

    assert.equal(receipt.currency, "EUR");
  });
});
