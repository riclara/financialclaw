import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeLogExpenseManual } from "../../src/tools/log-expense-manual.js";
import { createTestDb } from "../helpers/test-db.js";

// today = "2026-03-28" en la zona local cuando se usa esta fecha UTC al mediodía
const FIXED_NOW = "2026-03-28T12:00:00.000Z";

function withFixedDate<T>(callback: () => T): T {
  const RealDate = Date;

  class FixedDate extends Date {
    constructor(value?: string | number | Date) {
      if (arguments.length === 0) {
        super(FIXED_NOW);
        return;
      }

      super(value as string | number);
    }

    static now(): number {
      return new RealDate(FIXED_NOW).valueOf();
    }

    static parse(dateString: string): number {
      return RealDate.parse(dateString);
    }

    static UTC(
      year: number,
      monthIndex?: number,
      date?: number,
      hours?: number,
      minutes?: number,
      seconds?: number,
      ms?: number,
    ): number {
      return RealDate.UTC(year, monthIndex, date, hours, minutes, seconds, ms);
    }
  }

  globalThis.Date = FixedDate as DateConstructor;

  try {
    return callback();
  } finally {
    globalThis.Date = RealDate;
  }
}

type ExpenseRow = {
  id: string;
  amount: number;
  currency: string;
  category: string;
  merchant: string | null;
  description: string;
  due_date: string;
  payment_date: string | null;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
};

function getLastExpense(db: ReturnType<typeof createTestDb>): ExpenseRow {
  return db
    .prepare(
      `
        SELECT id, amount, currency, category, merchant, description,
               due_date, payment_date, status, source, created_at, updated_at
        FROM expenses
        ORDER BY created_at DESC
        LIMIT 1
      `,
    )
    .get() as ExpenseRow;
}

describe("log_expense_manual", () => {
  it("gasto con due_date igual a hoy queda PAID con payment_date = due_date", () => {
    const db = createTestDb();

    withFixedDate(() =>
      executeLogExpenseManual(
        { amount: 25000, description: "Café", due_date: "2026-03-28" },
        db,
      ),
    );

    const expense = getLastExpense(db);
    assert.equal(expense.status, "PAID");
    assert.equal(expense.payment_date, "2026-03-28");
    assert.equal(expense.source, "MANUAL");
  });

  it("gasto con due_date futura queda PENDING sin payment_date", () => {
    const db = createTestDb();

    withFixedDate(() =>
      executeLogExpenseManual(
        { amount: 50000, description: "Internet", due_date: "2026-03-29" },
        db,
      ),
    );

    const expense = getLastExpense(db);
    assert.equal(expense.status, "PENDING");
    assert.equal(expense.payment_date, null);
    assert.equal(expense.source, "MANUAL");
  });

  it("sin currency usa la moneda default (XXX del seed)", () => {
    const db = createTestDb();

    withFixedDate(() =>
      executeLogExpenseManual(
        { amount: 10000, description: "Mercado", due_date: "2026-03-29" },
        db,
      ),
    );

    const expense = getLastExpense(db);
    assert.equal(expense.currency, "XXX");
  });

  it("lanza error descriptivo si la currency solicitada no está registrada", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        withFixedDate(() =>
          executeLogExpenseManual(
            { amount: 10, description: "Compra", due_date: "2026-03-29", currency: "USD" },
            db,
          ),
        ),
      /USD/,
    );
  });

  it("la respuesta incluye el monto formateado con símbolo de moneda", () => {
    const db = createTestDb();

    const result = withFixedDate(() =>
      executeLogExpenseManual(
        { amount: 15000, description: "Supermercado", due_date: "2026-03-28" },
        db,
      ),
    );

    // Con moneda XXX el símbolo es ¤
    assert.match(result, /¤/);
    assert.match(result, /15/);
  });

  it("sugiere usar manage_currency cuando la moneda default sigue siendo XXX", () => {
    const db = createTestDb();

    const result = withFixedDate(() =>
      executeLogExpenseManual(
        { amount: 8000, description: "Transporte", due_date: "2026-03-29" },
        db,
      ),
    );

    assert.match(result, /manage_currency/);
  });

  it("sin category usa OTHER como valor por defecto", () => {
    const db = createTestDb();

    withFixedDate(() =>
      executeLogExpenseManual(
        { amount: 5000, description: "Varios", due_date: "2026-03-29" },
        db,
      ),
    );

    const expense = getLastExpense(db);
    assert.equal(expense.category, "OTHER");
  });

  it("lanza error si due_date no tiene formato YYYY-MM-DD", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeLogExpenseManual(
          { amount: 5000, description: "Test", due_date: "28/03/2026" },
          db,
        ),
      /YYYY-MM-DD/,
    );
  });

  it("merchant ausente queda null en BD y la respuesta sigue siendo legible", () => {
    const db = createTestDb();

    const result = withFixedDate(() =>
      executeLogExpenseManual(
        { amount: 3000, description: "Sin comercio", due_date: "2026-03-29" },
        db,
      ),
    );

    const expense = getLastExpense(db);
    assert.equal(expense.merchant, null);
    assert.ok(result.length > 0);
  });
});
