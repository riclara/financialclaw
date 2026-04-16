import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { createTestDb } from "../helpers/test-db.js";
import { executePlanAllocation } from "../../src/tools/plan-allocation.js";
import { todayISO } from "../../src/tools/helpers/date-utils.js";

// ─── helpers ──────────────────────────────────────────────────────────────────

function monthStart(): string {
  const today = todayISO();
  return `${today.slice(0, 7)}-01`;
}

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
    description?: string;
    dueDate: string;
    status?: string;
    paymentDate?: string;
    recurringRuleId?: string;
  },
): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO expenses (
      id, amount, currency, description, due_date, payment_date,
      status, source, recurring_rule_id, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', ?, 1, ?, ?)`,
  ).run(
    id,
    opts.amount,
    opts.currency,
    opts.description ?? "Gasto test",
    opts.dueDate,
    opts.paymentDate ?? null,
    opts.status ?? "PENDING",
    opts.recurringRuleId ?? null,
    now,
    now,
  );
  return id;
}

function insertRule(
  db: ReturnType<typeof createTestDb>,
  opts: {
    currency: string;
    amount: number;
    name?: string;
    frequency?: string;
    startsOn?: string;
    endsOn?: string;
  },
): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO recurring_expense_rules (
      id, name, amount, currency, frequency, starts_on, ends_on, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)`,
  ).run(
    id,
    opts.name ?? "Regla test",
    opts.amount,
    opts.currency,
    opts.frequency ?? "MONTHLY",
    opts.startsOn ?? monthStart(),
    opts.endsOn ?? null,
    now,
  );
  return id;
}

// ─── tests ────────────────────────────────────────────────────────────────────

describe("plan-allocation — integración", () => {
  it("sin compromisos: todo disponible", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    const result = executePlanAllocation({ amount: 4_000_000, currency: "COP" }, db);

    assert.ok(result.includes("Received:"), "debe mostrar monto recibido");
    assert.ok(result.includes("No pending commitments"), "debe indicar que no hay compromisos");
    assert.ok(result.includes("fully available"), "debe decir que todo está disponible");
    assert.ok(!result.includes("Pending commitments this month:"), "no debe mostrar sección de pendientes");
    assert.ok(!result.includes("Available:"), "no debe duplicar 'Available' cuando todo está disponible");
  });

  it("caso feliz: gastos pendientes correctamente distribuidos", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    const today = todayISO();
    insertExpense(db, { currency: "COP", amount: 1_500_000, description: "Arriendo", dueDate: today, status: "PENDING" });
    insertExpense(db, { currency: "COP", amount: 120_000, description: "Gimnasio", dueDate: today, status: "PENDING" });

    const result = executePlanAllocation({ amount: 4_000_000, currency: "COP" }, db);

    assert.ok(result.includes("Pending commitments this month:"), "debe mostrar sección de pendientes");
    assert.ok(result.includes("Arriendo"), "debe listar el arriendo");
    assert.ok(result.includes("Gimnasio"), "debe listar el gimnasio");
    assert.ok(result.includes("Total committed:"), "debe mostrar total comprometido");
    assert.ok(result.includes("Available:"), "debe mostrar disponible");
    assert.ok(!result.includes("exceed income"), "no debe mostrar advertencia de déficit");
  });

  it("compromisos superan el ingreso: muestra déficit con advertencia", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    const today = todayISO();
    insertExpense(db, { currency: "COP", amount: 3_000_000, description: "Arriendo", dueDate: today });
    insertExpense(db, { currency: "COP", amount: 2_500_000, description: "Deuda", dueDate: today });

    const result = executePlanAllocation({ amount: 4_000_000, currency: "COP" }, db);

    assert.ok(result.includes("exceed income"), "debe mostrar advertencia de exceso");
    assert.ok(result.includes("Deficit:"), "debe mostrar el déficit");
    assert.ok(!result.includes("Available:"), "no debe mostrar 'Available' cuando hay déficit");
  });

  it("moneda XXX: incluye sugerencia de manage_currency", () => {
    const db = createTestDb();
    // XXX es la moneda placeholder insertada por el seed

    const result = executePlanAllocation({ amount: 1_000_000 }, db);

    assert.ok(result.includes("manage_currency"), "debe sugerir configurar moneda");
    assert.ok(result.includes("Tip:"), "debe incluir el tip");
  });

  it("regla recurrente sin gasto generado: aparece como estimado", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    // Regla activa que comenzó este mes, sin gasto generado (daily-sync no corrió)
    insertRule(db, {
      currency: "COP",
      amount: 500_000,
      name: "Netflix",
      frequency: "MONTHLY",
      startsOn: monthStart(),
    });

    const result = executePlanAllocation({ amount: 2_000_000, currency: "COP" }, db);

    assert.ok(result.includes("Netflix"), "debe listar la regla no sincronizada");
    assert.ok(result.includes("(estimated)"), "debe marcarla como estimada");
    assert.ok(result.includes("Total committed:"), "debe incluir la regla en el total");
  });

  it("gasto ya pagado: aparece en sección informativa, no en pendientes", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    const today = todayISO();
    insertExpense(db, {
      currency: "COP",
      amount: 95_000,
      description: "Internet",
      dueDate: today,
      status: "PAID",
      paymentDate: today,
    });

    const result = executePlanAllocation({ amount: 2_000_000, currency: "COP" }, db);

    assert.ok(result.includes("Already paid this month:"), "debe mostrar sección de pagados");
    assert.ok(result.includes("Internet"), "debe listar el pago");
    assert.ok(result.includes("Total paid:"), "debe mostrar total pagado");
    assert.ok(!result.includes("Pending commitments this month:"), "no debe aparecer en pendientes");
    // El disponible debe ser el total (no descuenta pagados)
    assert.ok(result.includes("fully available") || result.includes("Available:"), "debe mostrar disponible");
  });

  it("múltiples monedas: muestra compromisos solo en la moneda solicitada + nota sobre otras", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    insertCurrency(db, "USD", "US$");
    setDefault(db, "COP");

    const today = todayISO();
    insertExpense(db, { currency: "COP", amount: 1_000_000, description: "Arriendo", dueDate: today });
    insertExpense(db, { currency: "USD", amount: 50, description: "Spotify", dueDate: today });

    const result = executePlanAllocation({ amount: 3_000_000, currency: "COP" }, db);

    assert.ok(result.includes("Arriendo"), "debe mostrar el gasto en COP");
    assert.ok(!result.includes("Spotify"), "no debe mostrar gastos en USD en la distribución");
    assert.ok(result.includes("Note:"), "debe agregar nota sobre otras monedas");
    assert.ok(result.includes("USD"), "la nota debe mencionar USD");
  });

  it("regla con ends_on antes del mes actual: no se incluye", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    const today = todayISO();
    const lastMonth = `${today.slice(0, 4)}-${String(Number(today.slice(5, 7)) - 1).padStart(2, "0")}-01`;

    insertRule(db, {
      currency: "COP",
      amount: 200_000,
      name: "Regla expirada",
      frequency: "MONTHLY",
      startsOn: "2025-01-01",
      // ends_on en el mes anterior = ya expiró
      endsOn: lastMonth > "2025-01-01" ? lastMonth : "2025-01-01",
    });

    const result = executePlanAllocation({ amount: 2_000_000, currency: "COP" }, db);

    // Si ends_on < monthStart, no debe aparecer
    // Nota: si el test corre en febrero, lastMonth puede ser enero que aún es válido;
    // pero el test base (sin enero como mes actual) debería filtrar correctamente.
    // Para un test robusto, forzamos ends_on a un mes claramente anterior
    const db2 = createTestDb();
    insertCurrency(db2, "COP", "$", true);
    setDefault(db2, "COP");
    insertRule(db2, {
      currency: "COP",
      amount: 200_000,
      name: "Regla expirada",
      frequency: "MONTHLY",
      startsOn: "2020-01-01",
      endsOn: "2020-12-31", // claramente en el pasado
    });

    const result2 = executePlanAllocation({ amount: 2_000_000, currency: "COP" }, db2);
    assert.ok(!result2.includes("Regla expirada"), "regla expirada no debe aparecer");
    assert.ok(result2.includes("No pending commitments") || !result2.includes("(estimated)"), "no debe incluir la regla expirada como estimada");
  });
});
