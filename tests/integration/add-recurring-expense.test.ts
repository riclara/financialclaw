import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createTestDb } from "../helpers/test-db.js";
import { executeAddRecurringExpense } from "../../src/tools/add-recurring-expense.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function insertCop(db: ReturnType<typeof createTestDb>): void {
  db.prepare(
    `INSERT OR IGNORE INTO currencies (code, name, symbol, is_default) VALUES ('COP', 'Peso colombiano', '$', 0)`,
  ).run();
}

function setDefault(db: ReturnType<typeof createTestDb>, code: string): void {
  db.prepare(`UPDATE currencies SET is_default = 0`).run();
  db.prepare(`UPDATE currencies SET is_default = 1 WHERE code = ?`).run(code);
}

function extractRuleId(msg: string): string {
  const match = /regla: ([a-f0-9-]+)\)/.exec(msg);
  if (!match) throw new Error(`No se encontró rule ID en: ${msg}`);
  return match[1];
}

function extractExpenseId(msg: string): string {
  const match = /gasto: ([a-f0-9-]+)\)/.exec(msg);
  if (!match) throw new Error(`No se encontró expense ID en: ${msg}`);
  return match[1];
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("add-recurring-expense — integración", () => {
  // ── inserción exitosa de regla ────────────────────────────────────────────

  it("inserta la regla con los campos correctos y name = description", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const msg = executeAddRecurringExpense(
      {
        description: "Arriendo",
        amount: 1_500_000,
        currency: "COP",
        frequency: "MONTHLY",
        starts_on: "2026-04-01",
      },
      db,
    );

    const ruleId = extractRuleId(msg);
    const rule = db
      .prepare(`SELECT * FROM recurring_expense_rules WHERE id = ?`)
      .get(ruleId) as Record<string, unknown>;

    assert.equal(rule["name"], "Arriendo");
    assert.equal(rule["amount"], 1_500_000);
    assert.equal(rule["currency"], "COP");
    assert.equal(rule["frequency"], "MONTHLY");
    assert.equal(rule["starts_on"], "2026-04-01");
    assert.equal(rule["is_active"], 1);
  });

  // ── day_of_month queda NULL ───────────────────────────────────────────────

  it("day_of_month queda NULL en la regla (MONTHLY ancla a starts_on)", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const msg = executeAddRecurringExpense(
      {
        description: "Suscripción",
        amount: 20_000,
        currency: "COP",
        frequency: "MONTHLY",
        starts_on: "2026-04-15",
      },
      db,
    );

    const ruleId = extractRuleId(msg);
    const rule = db
      .prepare(`SELECT day_of_month FROM recurring_expense_rules WHERE id = ?`)
      .get(ruleId) as { day_of_month: unknown };

    assert.equal(rule.day_of_month, null);
  });

  // ── generación del primer gasto ───────────────────────────────────────────

  it("genera el primer gasto con campos correctos", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const msg = executeAddRecurringExpense(
      {
        description: "Internet",
        amount: 80_000,
        currency: "COP",
        merchant: "Claro",
        frequency: "MONTHLY",
        starts_on: "2026-04-05",
      },
      db,
    );

    const ruleId = extractRuleId(msg);
    const expenseId = extractExpenseId(msg);

    const expense = db
      .prepare(`SELECT * FROM expenses WHERE id = ?`)
      .get(expenseId) as Record<string, unknown>;

    assert.equal(expense["description"], "Internet");
    assert.equal(expense["amount"], 80_000);
    assert.equal(expense["currency"], "COP");
    assert.equal(expense["merchant"], "Claro");
    assert.equal(expense["due_date"], "2026-04-05");
    assert.equal(expense["status"], "PENDING");
    assert.equal(expense["source"], "MANUAL");
    assert.equal(expense["recurring_rule_id"], ruleId);
    assert.equal(expense["generated_from_rule"], 1);
  });

  // ── updated_at del primer gasto no queda nulo ─────────────────────────────

  it("updated_at del primer gasto se setea explícitamente y no queda nulo", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const msg = executeAddRecurringExpense(
      {
        description: "Luz",
        amount: 50_000,
        currency: "COP",
        frequency: "MONTHLY",
        starts_on: "2026-04-01",
      },
      db,
    );

    const expenseId = extractExpenseId(msg);
    const expense = db
      .prepare(`SELECT updated_at FROM expenses WHERE id = ?`)
      .get(expenseId) as { updated_at: string | null };

    assert.ok(expense.updated_at !== null, "updated_at no debe ser null");
    assert.ok(expense.updated_at.length > 0, "updated_at no debe estar vacío");
  });

  // ── creación de reminder ──────────────────────────────────────────────────

  it("crea reminder con scheduled_date correcto cuando reminder_days_before está presente", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const msg = executeAddRecurringExpense(
      {
        description: "Tarjeta",
        amount: 200_000,
        currency: "COP",
        frequency: "MONTHLY",
        starts_on: "2026-04-05",
        reminder_days_before: 3,
      },
      db,
    );

    assert.ok(msg.includes("2026-04-02"), `esperaba scheduled_date 2026-04-02 en: ${msg}`);

    const expenseId = extractExpenseId(msg);
    const reminder = db
      .prepare(`SELECT * FROM reminders WHERE expense_id = ?`)
      .get(expenseId) as Record<string, unknown> | undefined;

    assert.ok(reminder !== undefined, "debe existir el reminder");
    assert.equal(reminder["scheduled_date"], "2026-04-02");
    assert.equal(reminder["days_before"], 3);
    assert.equal(reminder["sent"], 0);
  });

  // ── error por INTERVAL_DAYS sin interval_days ─────────────────────────────

  it("lanza error descriptivo cuando frequency=INTERVAL_DAYS sin interval_days", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeAddRecurringExpense(
          {
            description: "Gym",
            amount: 50_000,
            frequency: "INTERVAL_DAYS",
            starts_on: "2026-04-01",
          },
          db,
        ),
      /interval_days.*obligatorio|obligatorio.*interval_days/i,
    );
  });

  // ── moneda default usada cuando currency se omite ─────────────────────────

  it("usa la moneda default cuando currency no se proporciona", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    const msg = executeAddRecurringExpense(
      {
        description: "Agua",
        amount: 30_000,
        frequency: "MONTHLY",
        starts_on: "2026-04-01",
      },
      db,
    );

    const ruleId = extractRuleId(msg);
    const rule = db
      .prepare(`SELECT currency FROM recurring_expense_rules WHERE id = ?`)
      .get(ruleId) as { currency: string };

    assert.equal(rule.currency, "COP");
  });

  // ── respuesta sugiere manage_currency cuando moneda sigue en XXX ──────────

  it("sugiere manage_currency cuando la moneda efectiva es XXX", () => {
    const db = createTestDb();
    // XXX es la default del seed; no registramos otra moneda

    const msg = executeAddRecurringExpense(
      {
        description: "Gas",
        amount: 40_000,
        frequency: "MONTHLY",
        starts_on: "2026-04-01",
      },
      db,
    );

    assert.ok(msg.includes("manage_currency"), `esperaba sugerencia en: ${msg}`);
  });

  // ── validación de fecha calendario inválida en starts_on ──────────────────

  it("lanza error si starts_on tiene formato válido pero fecha imposible", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeAddRecurringExpense(
          {
            description: "Préstamo",
            amount: 100_000,
            frequency: "MONTHLY",
            starts_on: "2026-02-30",
          },
          db,
        ),
      /no es una fecha válida/i,
    );
  });

  // ── validación de description con solo espacios ───────────────────────────

  it("lanza error si description contiene solo espacios", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeAddRecurringExpense(
          {
            description: "   ",
            amount: 50_000,
            frequency: "MONTHLY",
            starts_on: "2026-04-01",
          },
          db,
        ),
      /description.*vacío|vacío.*description/i,
    );
  });

  // ── [P2] starts_on posterior a ends_on es rechazado ─────────────────────

  it("lanza error si starts_on es posterior a ends_on", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeAddRecurringExpense(
          {
            description: "Póliza",
            amount: 100_000,
            frequency: "MONTHLY",
            starts_on: "2026-05-01",
            ends_on: "2026-04-01",
          },
          db,
        ),
      /starts_on.*posterior|posterior.*ends_on/i,
    );
  });

  // ── [P2] Próxima fecha omitida cuando cae fuera de la ventana ────────────

  it("no incluye Próxima fecha cuando nextDate supera ends_on", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    // starts_on = ends_on → la única ocurrencia es la de starts_on, la siguiente cae fuera
    const msg = executeAddRecurringExpense(
      {
        description: "Evento único",
        amount: 50_000,
        currency: "COP",
        frequency: "MONTHLY",
        starts_on: "2026-04-01",
        ends_on: "2026-04-01",
      },
      db,
    );

    assert.ok(!msg.includes("Próxima fecha:"), `no debería incluir Próxima fecha en: ${msg}`);
    assert.ok(msg.includes("ventana de vigencia"), `debería mencionar ventana en: ${msg}`);
  });

  // ── el índice único impide duplicate expense para la misma regla y fecha ──

  it("el índice único impide un segundo INSERT de expense con misma recurring_rule_id y due_date", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    // Crear una regla e insertar el primer gasto vía el tool
    const msg = executeAddRecurringExpense(
      {
        description: "Servicio",
        amount: 60_000,
        currency: "COP",
        frequency: "MONTHLY",
        starts_on: "2026-04-01",
      },
      db,
    );

    const ruleId = extractRuleId(msg);

    // Intentar insertar directamente un segundo expense con la misma regla y fecha
    assert.throws(() => {
      db.prepare(
        `INSERT INTO expenses (
          id, amount, currency, category, description, due_date,
          status, source, recurring_rule_id, generated_from_rule,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      ).run(
        "00000000-0000-0000-0000-000000000001",
        60_000,
        "COP",
        "OTHER",
        "Servicio",
        "2026-04-01",
        "PENDING",
        "MANUAL",
        ruleId,
        1,
        1,
      );
    }, /UNIQUE constraint failed/i);
  });
});
