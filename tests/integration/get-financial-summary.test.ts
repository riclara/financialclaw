import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createTestDb } from "../helpers/test-db.js";
import { executeGetFinancialSummary } from "../../src/tools/get-financial-summary.js";
import {
  todayISO,
  resolvePeriodRange,
} from "../../src/tools/helpers/date-utils.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function insertCurrency(
  db: ReturnType<typeof createTestDb>,
  code: string,
  symbol: string,
  isDefault = false,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO currencies (code, name, symbol, is_default) VALUES (?, ?, ?, ?)`,
  ).run(code, code, symbol, isDefault ? 1 : 0);
}

function setDefault(db: ReturnType<typeof createTestDb>, code: string): void {
  db.prepare(`UPDATE currencies SET is_default = 0`).run();
  db.prepare(`UPDATE currencies SET is_default = 1 WHERE code = ?`).run(code);
}

function insertExpense(
  db: ReturnType<typeof createTestDb>,
  opts: {
    currency: string;
    amount: number;
    category?: string;
    dueDate: string;
    status?: string;
  },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO expenses (
      id, amount, currency, category, description, due_date,
      status, source, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, 'Test', ?, ?, 'MANUAL', 1, ?, ?)`,
  ).run(
    randomUUID(),
    opts.amount,
    opts.currency,
    opts.category ?? "OTHER",
    opts.dueDate,
    opts.status ?? "PENDING",
    now,
    now,
  );
}

function insertIncomeWithReceipt(
  db: ReturnType<typeof createTestDb>,
  opts: { currency: string; amount: number; date: string },
): void {
  const now = new Date().toISOString();
  const incomeId = randomUUID();
  db.prepare(
    `INSERT INTO incomes (id, reason, expected_amount, currency, date, is_recurring, is_active, created_at)
     VALUES (?, 'Salario', ?, ?, ?, 0, 1, ?)`,
  ).run(incomeId, opts.amount, opts.currency, opts.date, now);
  db.prepare(
    `INSERT INTO income_receipts (id, income_id, amount, currency, date, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), incomeId, opts.amount, opts.currency, opts.date, now);
}

function insertRule(
  db: ReturnType<typeof createTestDb>,
  opts: {
    currency: string;
    amount: number;
    name?: string;
    frequency?: string;
    isActive?: number;
  },
): void {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO recurring_expense_rules (
      id, name, amount, currency, frequency, starts_on,
      reminder_days_before, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, '2026-01-01', 0, ?, ?)`,
  ).run(
    randomUUID(),
    opts.name ?? "Regla",
    opts.amount,
    opts.currency,
    opts.frequency ?? "MONTHLY",
    opts.isActive ?? 1,
    now,
  );
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("get-financial-summary — integración", () => {
  // ── resumen vacío legible ─────────────────────────────────────────────────

  it("devuelve resumen legible cuando no hay datos", () => {
    const db = createTestDb();

    const result = executeGetFinancialSummary({}, db);

    assert.ok(result.length > 0, "resultado no debe estar vacío");
    assert.ok(result.includes("Period:"), result);
    assert.ok(result.includes("No transactions"), result);
    assert.ok(result.includes("Active recurring commitments: 0"), result);
  });

  // ── resumen con gastos en una moneda ──────────────────────────────────────

  it("suma correctamente gastos de una sola moneda", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);

    const today = todayISO();
    insertExpense(db, { currency: "COP", amount: 100_000, category: "RESTAURANTE", dueDate: today });
    insertExpense(db, { currency: "COP", amount: 200_000, category: "SUPERMERCADO", dueDate: today });

    const result = executeGetFinancialSummary({ period: "this_month" }, db);

    assert.ok(result.includes("COP"), result);
    assert.ok(result.includes("RESTAURANTE"), result);
    assert.ok(result.includes("SUPERMERCADO"), result);
    // Total = 300.000
    assert.ok(result.includes("300.000"), result);
  });

  // ── resumen con gastos en múltiples monedas sin mezclarlos ────────────────

  it("muestra secciones separadas por moneda sin mezclar totales", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    insertCurrency(db, "EUR", "€");

    const today = todayISO();
    insertExpense(db, { currency: "COP", amount: 500_000, dueDate: today });
    insertExpense(db, { currency: "EUR", amount: 100, dueDate: today });

    const result = executeGetFinancialSummary({}, db);

    // Ambas monedas deben aparecer como secciones separadas
    assert.ok(result.includes("COP"), result);
    assert.ok(result.includes("EUR"), result);

    // COP must appear before EUR (sorted alphabetically)
    assert.ok(result.indexOf("COP") < result.indexOf("EUR"), result);

    // No debe mezclar: la línea "Gastos totales" de COP no debe contener "EUR"
    const copSection = result.split("EUR")[0];
    assert.ok(copSection.includes("500.000"), result);
  });

  // ── resumen con ingresos ──────────────────────────────────────────────────

  it("incluye ingresos recibidos del período", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);

    const today = todayISO();
    insertIncomeWithReceipt(db, { currency: "COP", amount: 2_000_000, date: today });

    const result = executeGetFinancialSummary({ period: "this_month" }, db);

    assert.ok(result.includes("Income received"), result);
    assert.ok(result.includes("2.000.000"), result);
  });

  // ── conteo de reglas recurrentes activas ──────────────────────────────────

  it("muestra reglas activas y omite las inactivas", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);

    insertRule(db, { currency: "COP", amount: 1_500_000, name: "Arriendo", isActive: 1 });
    insertRule(db, { currency: "COP", amount: 50_000, name: "Cancelada", isActive: 0 });

    const result = executeGetFinancialSummary({}, db);

    assert.ok(result.includes("Arriendo"), result);
    assert.ok(!result.includes("Cancelada"), result);
    assert.ok(result.includes("Active recurring commitments: 1"), result);
  });

  // ── filtro por this_month ─────────────────────────────────────────────────

  it("this_month solo incluye gastos del mes actual", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);

    const inRange = resolvePeriodRange("this_month")!.start;
    insertExpense(db, { currency: "COP", amount: 111_000, dueDate: inRange });
    insertExpense(db, { currency: "COP", amount: 999_000, dueDate: "2020-01-01" }); // fuera

    const result = executeGetFinancialSummary({ period: "this_month" }, db);

    assert.ok(result.includes("111.000"), result);
    assert.ok(!result.includes("999.000"), result);
  });

  // ── filtro por last_month ─────────────────────────────────────────────────

  it("last_month solo incluye gastos del mes anterior", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);

    const inRange = resolvePeriodRange("last_month")!.start;
    insertExpense(db, { currency: "COP", amount: 222_000, dueDate: inRange });
    insertExpense(db, { currency: "COP", amount: 999_000, dueDate: todayISO() }); // este mes

    const result = executeGetFinancialSummary({ period: "last_month" }, db);

    assert.ok(result.includes("222.000"), result);
    assert.ok(!result.includes("999.000"), result);
  });

  // ── filtro por last_30_days ───────────────────────────────────────────────

  it("last_30_days solo incluye gastos en los últimos 30 días", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);

    const inRange = resolvePeriodRange("last_30_days")!.start;
    insertExpense(db, { currency: "COP", amount: 333_000, dueDate: inRange });
    insertExpense(db, { currency: "COP", amount: 999_000, dueDate: "2020-01-01" }); // fuera

    const result = executeGetFinancialSummary({ period: "last_30_days" }, db);

    assert.ok(result.includes("333.000"), result);
    assert.ok(!result.includes("999.000"), result);
  });

  // ── filtro por this_year ──────────────────────────────────────────────────

  it("this_year solo incluye gastos del año actual", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);

    const inRange = resolvePeriodRange("this_year")!.start;
    insertExpense(db, { currency: "COP", amount: 444_000, dueDate: inRange });
    insertExpense(db, { currency: "COP", amount: 999_000, dueDate: "2020-12-31" }); // año pasado

    const result = executeGetFinancialSummary({ period: "this_year" }, db);

    assert.ok(result.includes("444.000"), result);
    assert.ok(!result.includes("999.000"), result);
  });

  // ── filtro por currency ───────────────────────────────────────────────────

  it("filtra por moneda y muestra solo esa sección", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    insertCurrency(db, "EUR", "€");

    const today = todayISO();
    insertExpense(db, { currency: "COP", amount: 500_000, dueDate: today });
    insertExpense(db, { currency: "EUR", amount: 200, dueDate: today });

    const result = executeGetFinancialSummary({ period: "this_month", currency: "COP" }, db);

    assert.ok(result.includes("COP"), result);
    // EUR expenses should not appear when filtering by COP
    assert.ok(!result.includes("200 EUR") && !result.includes("200.000 EUR"), result);
  });

  // ── currency no registrada lanza error descriptivo ────────────────────────

  it("lanza error descriptivo si la moneda del filtro no está registrada", () => {
    const db = createTestDb();

    assert.throws(
      () => executeGetFinancialSummary({ currency: "JPY" }, db),
      /JPY.*is not registered|is not registered.*JPY/i,
    );
  });

  // ── reglas activas aparecen aunque no haya movimientos en el período ───────

  it("las reglas activas aparecen aunque no haya gastos en el período", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);

    // Sin gastos ni ingresos, solo una regla
    insertRule(db, { currency: "COP", amount: 800_000, name: "Internet" });

    const result = executeGetFinancialSummary({ period: "this_month" }, db);

    assert.ok(result.includes("Internet"), result);
    assert.ok(result.includes("Active recurring commitments: 1"), result);
  });

  // ── balance recibido se calcula correctamente ─────────────────────────────

  it("balance recibido = ingresos recibidos - gastos totales", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);

    const today = todayISO();
    insertIncomeWithReceipt(db, { currency: "COP", amount: 1_000_000, date: today });
    insertExpense(db, { currency: "COP", amount: 300_000, dueDate: today });

    const result = executeGetFinancialSummary({ period: "this_month" }, db);

    // Balance = 1.000.000 - 300.000 = 700.000
    assert.ok(result.includes("700.000"), result);
  });
});
