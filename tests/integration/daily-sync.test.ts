import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createTestDb } from "../helpers/test-db.js";
import { dailySync } from "../../src/services/daily-sync.js";
import { executeAddRecurringExpense } from "../../src/tools/add-recurring-expense.js";

function insertCop(db: ReturnType<typeof createTestDb>): void {
  db.prepare(
    `INSERT OR IGNORE INTO currencies (code, name, symbol, is_default) VALUES ('COP', 'Peso colombiano', '$', 0)`,
  ).run();
}

function setDefault(db: ReturnType<typeof createTestDb>, code: string): void {
  db.prepare(`UPDATE currencies SET is_default = 0`).run();
  db.prepare(`UPDATE currencies SET is_default = 1 WHERE code = ?`).run(code);
}

function extractRuleId(message: string): string {
  const match = /regla: ([a-f0-9-]+)\)/.exec(message);

  if (match === null) {
    throw new Error(`No se encontró rule ID en: ${message}`);
  }

  return match[1];
}

function seedRecurringRule(
  db: ReturnType<typeof createTestDb>,
  input: Parameters<typeof executeAddRecurringExpense>[0],
): string {
  const message = executeAddRecurringExpense(input, db);
  return extractRuleId(message);
}

describe("daily-sync — integración", () => {
  it("genera gastos faltantes para una regla mensual hasta la fecha de sync", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");
    const ruleId = seedRecurringRule(db, {
      description: "Arriendo",
      amount: 1_500_000,
      currency: "COP",
      frequency: "MONTHLY",
      starts_on: "2026-03-05",
    });

    const result = dailySync(db, "2026-05-10");
    const expenses = db
      .prepare(
        `SELECT due_date
         FROM expenses
         WHERE recurring_rule_id = ?
         ORDER BY due_date ASC`,
      )
      .all(ruleId) as Array<{ due_date: string }>;

    assert.equal(result.expensesGenerated, 2);
    assert.deepEqual(
      expenses.map((expense) => expense.due_date),
      ["2026-03-05", "2026-04-05", "2026-05-05"],
    );
  });

  it("se pone al día con gaps largos en reglas INTERVAL_DAYS", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");
    const ruleId = seedRecurringRule(db, {
      description: "Ahorro programado",
      amount: 100_000,
      currency: "COP",
      frequency: "INTERVAL_DAYS",
      interval_days: 10,
      starts_on: "2026-03-01",
    });

    const result = dailySync(db, "2026-04-05");
    const expenses = db
      .prepare(
        `SELECT due_date
         FROM expenses
         WHERE recurring_rule_id = ?
         ORDER BY due_date ASC`,
      )
      .all(ruleId) as Array<{ due_date: string }>;

    assert.equal(result.expensesGenerated, 3);
    assert.deepEqual(
      expenses.map((expense) => expense.due_date),
      ["2026-03-01", "2026-03-11", "2026-03-21", "2026-03-31"],
    );
  });

  it("respeta ends_on y no genera ocurrencias posteriores", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");
    const ruleId = seedRecurringRule(db, {
      description: "Membresía",
      amount: 90_000,
      currency: "COP",
      frequency: "MONTHLY",
      starts_on: "2026-03-05",
      ends_on: "2026-04-05",
    });

    const result = dailySync(db, "2026-06-10");
    const expenses = db
      .prepare(
        `SELECT due_date
         FROM expenses
         WHERE recurring_rule_id = ?
         ORDER BY due_date ASC`,
      )
      .all(ruleId) as Array<{ due_date: string }>;

    assert.equal(result.expensesGenerated, 1);
    assert.deepEqual(
      expenses.map((expense) => expense.due_date),
      ["2026-03-05", "2026-04-05"],
    );
  });

  it("ignora reglas inactivas aunque tengan más fechas por generar", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");
    const ruleId = seedRecurringRule(db, {
      description: "Plataforma",
      amount: 45_000,
      currency: "COP",
      frequency: "MONTHLY",
      starts_on: "2026-03-05",
    });

    db.prepare(`UPDATE recurring_expense_rules SET is_active = 0 WHERE id = ?`).run(ruleId);

    const result = dailySync(db, "2026-05-10");
    const expenseCount = db
      .prepare(`SELECT COUNT(*) AS count FROM expenses WHERE recurring_rule_id = ?`)
      .get(ruleId) as { count: number };

    assert.equal(result.expensesGenerated, 0);
    assert.equal(expenseCount.count, 1);
  });

  it("es idempotente si se ejecuta dos veces el mismo día", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");
    const ruleId = seedRecurringRule(db, {
      description: "Colegiatura",
      amount: 300_000,
      currency: "COP",
      frequency: "MONTHLY",
      starts_on: "2026-03-05",
    });

    const firstRun = dailySync(db, "2026-05-10");
    const secondRun = dailySync(db, "2026-05-10");
    const expenseCount = db
      .prepare(`SELECT COUNT(*) AS count FROM expenses WHERE recurring_rule_id = ?`)
      .get(ruleId) as { count: number };

    assert.equal(firstRun.expensesGenerated, 2);
    assert.equal(secondRun.expensesGenerated, 0);
    assert.equal(expenseCount.count, 3);
  });

  it("marca gastos vencidos como OVERDUE sin tocar PAID ni OVERDUE", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");
    const now = "2026-03-01T10:15:00.000Z";

    db.prepare(
      `INSERT INTO expenses (
        id, amount, currency, category, merchant, description, due_date,
        payment_date, status, source, ocr_extraction_id, recurring_rule_id,
        generated_from_rule, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "expense-pending",
      100_000,
      "COP",
      "SERVICES",
      null,
      "Pendiente vencido",
      "2026-02-25",
      null,
      "PENDING",
      "MANUAL",
      null,
      null,
      0,
      1,
      now,
      now,
    );

    db.prepare(
      `INSERT INTO expenses (
        id, amount, currency, category, merchant, description, due_date,
        payment_date, status, source, ocr_extraction_id, recurring_rule_id,
        generated_from_rule, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "expense-paid",
      150_000,
      "COP",
      "SERVICES",
      null,
      "Ya pagado",
      "2026-02-20",
      "2026-02-19",
      "PAID",
      "MANUAL",
      null,
      null,
      0,
      1,
      now,
      now,
    );

    db.prepare(
      `INSERT INTO expenses (
        id, amount, currency, category, merchant, description, due_date,
        payment_date, status, source, ocr_extraction_id, recurring_rule_id,
        generated_from_rule, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "expense-overdue",
      175_000,
      "COP",
      "SERVICES",
      null,
      "Ya vencido",
      "2026-02-10",
      null,
      "OVERDUE",
      "MANUAL",
      null,
      null,
      0,
      1,
      now,
      now,
    );

    db.prepare(
      `INSERT INTO expenses (
        id, amount, currency, category, merchant, description, due_date,
        payment_date, status, source, ocr_extraction_id, recurring_rule_id,
        generated_from_rule, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "expense-today",
      80_000,
      "COP",
      "SERVICES",
      null,
      "Vence hoy",
      "2026-03-10",
      null,
      "PENDING",
      "MANUAL",
      null,
      null,
      0,
      1,
      now,
      now,
    );

    const result = dailySync(db, "2026-03-10");
    const statuses = db
      .prepare(`SELECT id, status FROM expenses ORDER BY id ASC`)
      .all() as Array<{ id: string; status: string }>;

    assert.equal(result.expensesMarkedOverdue, 1);
    assert.deepEqual(statuses, [
      { id: "expense-overdue", status: "OVERDUE" },
      { id: "expense-paid", status: "PAID" },
      { id: "expense-pending", status: "OVERDUE" },
      { id: "expense-today", status: "PENDING" },
    ]);
  });

  it("retorna reminders pendientes con scheduled_date <= today y sent = 0", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");
    seedRecurringRule(db, {
      description: "Tarjeta",
      amount: 200_000,
      currency: "COP",
      frequency: "MONTHLY",
      starts_on: "2026-03-10",
      reminder_days_before: 3,
    });

    const result = dailySync(db, "2026-04-10");

    assert.equal(result.expensesGenerated, 1);
    assert.equal(result.remindersDue.length, 2);
    assert.deepEqual(result.remindersDue, [
      {
        expense_id: result.remindersDue[0].expense_id,
        reminder_id: result.remindersDue[0].reminder_id,
        description: "Tarjeta",
        amount: 200_000,
        currency: "COP",
        due_date: "2026-03-10",
        days_before: 3,
      },
      {
        expense_id: result.remindersDue[1].expense_id,
        reminder_id: result.remindersDue[1].reminder_id,
        description: "Tarjeta",
        amount: 200_000,
        currency: "COP",
        due_date: "2026-04-10",
        days_before: 3,
      },
    ]);

    assert.notEqual(result.remindersDue[0].expense_id, result.remindersDue[1].expense_id);
    assert.notEqual(result.remindersDue[0].reminder_id, result.remindersDue[1].reminder_id);
  });
});
