import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeLogIncome } from "../../src/tools/log-income.js";
import { createTestDb } from "../helpers/test-db.js";

type IncomeRow = {
  id: string;
  reason: string;
  expected_amount: number;
  currency: string;
  date: string;
  frequency: string | null;
  interval_days: number | null;
  is_recurring: number;
  next_expected_receipt_date: string | null;
  is_active: number;
};

type ReceiptRow = {
  id: string;
  income_id: string;
  amount: number;
  currency: string;
  date: string;
  notes: string | null;
};

function getLastIncome(db: ReturnType<typeof createTestDb>): IncomeRow {
  return db
    .prepare(
      `
        SELECT id, reason, expected_amount, currency, date, frequency,
               interval_days, is_recurring, next_expected_receipt_date, is_active
        FROM incomes
        ORDER BY created_at DESC
        LIMIT 1
      `,
    )
    .get() as IncomeRow;
}

function getReceiptsForIncome(
  db: ReturnType<typeof createTestDb>,
  incomeId: string,
): ReceiptRow[] {
  return db
    .prepare(
      `
        SELECT id, income_id, amount, currency, date, notes
        FROM income_receipts
        WHERE income_id = ?
      `,
    )
    .all(incomeId) as ReceiptRow[];
}

describe("log_income", () => {
  it("ingreso no recurrente persiste con is_recurring=0 y next_expected_receipt_date=null", () => {
    const db = createTestDb();

    executeLogIncome(
      {
        reason: "Salario",
        expected_amount: 3000000,
        date: "2026-03-28",
      },
      db,
    );

    const income = getLastIncome(db);
    assert.equal(income.reason, "Salario");
    assert.equal(income.expected_amount, 3000000);
    assert.equal(income.is_recurring, 0);
    assert.equal(income.next_expected_receipt_date, null);
    assert.equal(income.frequency, null);

    const receipts = getReceiptsForIncome(db, income.id);
    assert.equal(receipts.length, 1);
    assert.equal(receipts[0].amount, 3000000);
    assert.equal(receipts[0].date, "2026-03-28");
    assert.equal(receipts[0].income_id, income.id);
  });

  it("ingreso recurrente semanal calcula correctamente la próxima fecha", () => {
    const db = createTestDb();

    executeLogIncome(
      {
        reason: "Freelance semanal",
        expected_amount: 500000,
        date: "2026-03-28",
        recurring: true,
        frequency: "WEEKLY",
      },
      db,
    );

    const income = getLastIncome(db);
    assert.equal(income.is_recurring, 1);
    assert.equal(income.frequency, "WEEKLY");
    assert.equal(income.next_expected_receipt_date, "2026-04-04");
  });

  it("ingreso recurrente mensual calcula correctamente la próxima fecha", () => {
    const db = createTestDb();

    executeLogIncome(
      {
        reason: "Arriendo cobrado",
        expected_amount: 1200000,
        date: "2026-03-28",
        recurring: true,
        frequency: "MONTHLY",
      },
      db,
    );

    const income = getLastIncome(db);
    assert.equal(income.is_recurring, 1);
    assert.equal(income.frequency, "MONTHLY");
    assert.equal(income.next_expected_receipt_date, "2026-04-28");
  });

  it("lanza error descriptivo cuando recurring=true sin frequency", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeLogIncome(
          {
            reason: "Ingreso sin frecuencia",
            expected_amount: 100000,
            date: "2026-03-28",
            recurring: true,
          },
          db,
        ),
      /frequency/,
    );
  });

  it("lanza error descriptivo cuando frequency=INTERVAL_DAYS sin interval_days", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeLogIncome(
          {
            reason: "Ingreso por días",
            expected_amount: 200000,
            date: "2026-03-28",
            recurring: true,
            frequency: "INTERVAL_DAYS",
          },
          db,
        ),
      /interval_days/,
    );
  });

  it("sin currency usa la moneda default (XXX del seed)", () => {
    const db = createTestDb();

    executeLogIncome(
      {
        reason: "Consultoría",
        expected_amount: 800000,
        date: "2026-03-28",
      },
      db,
    );

    const income = getLastIncome(db);
    assert.equal(income.currency, "XXX");

    const receipts = getReceiptsForIncome(db, income.id);
    assert.equal(receipts[0].currency, "XXX");
  });

  it("lanza error cuando reason contiene solo espacios", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeLogIncome(
          {
            reason: "   ",
            expected_amount: 100000,
            date: "2026-03-28",
          },
          db,
        ),
      /reason/,
    );
  });

  it("lanza error cuando date es una fecha imposible en el calendario", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeLogIncome(
          {
            reason: "Salario",
            expected_amount: 100000,
            date: "2026-02-30",
          },
          db,
        ),
      /not a valid calendar date/,
    );
  });

  it("sugiere usar manage_currency cuando la moneda default sigue siendo XXX", () => {
    const db = createTestDb();

    const result = executeLogIncome(
      {
        reason: "Bono",
        expected_amount: 250000,
        date: "2026-03-28",
      },
      db,
    );

    assert.match(result, /manage_currency/);
  });
});
