import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeListExpenses } from "../../src/tools/list-expenses.js";
import { executeLogExpenseManual } from "../../src/tools/log-expense-manual.js";
import { createTestDb } from "../helpers/test-db.js";

function seedExpenses(db: ReturnType<typeof createTestDb>) {
  const today = "2026-03-28";
  const yesterday = "2026-03-27";
  const lastMonth = "2026-02-15";

  executeLogExpenseManual({
    amount: 50000,
    description: "Supermercado Éxito",
    category: "SUPERMARKET",
    due_date: today,
  }, db);

  executeLogExpenseManual({
    amount: 25000,
    description: "Uber al trabajo",
    category: "TRANSPORT",
    due_date: yesterday,
  }, db);

  executeLogExpenseManual({
    amount: 15000,
    description: "Café Juan Valdez",
    category: "OTHER",
    due_date: lastMonth,
  }, db);

  executeLogExpenseManual({
    amount: 80000,
    description: "Restaurante ANDRES",
    category: "RESTAURANT",
    due_date: today,
    merchant: "Restaurante ANDRES",
  }, db);

  executeLogExpenseManual({
    amount: 120000,
    description: "Arriendo marzo",
    category: "HOUSING",
    due_date: "2026-03-01",
  }, db);
}

describe("list_expenses", () => {
  it("retorna mensaje claro cuando no hay resultados", () => {
    const db = createTestDb();
    const result = executeListExpenses({ period: "all" }, db);

    assert.match(result, /No expenses recorded/);
  });

  it("lista gastos sin filtros de período (period: all)", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({ period: "all" }, db);

    assert.match(result, /Expenses/);
    assert.match(result, /2026-03-28/);
    assert.match(result, /2026-03-27/);
    assert.match(result, /Supermercado/);
  });

  it("filtra por categoría", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({ period: "all", category: "SUPERMARKET" }, db);

    assert.match(result, /Supermercado/);
    assert.doesNotMatch(result, /Uber/);
  });

  it("filtra por estado", () => {
    const db = createTestDb();
    seedExpenses(db);

    db.prepare("UPDATE expenses SET status = ? WHERE description = ?").run("OVERDUE", "Arriendo marzo");

    const result = executeListExpenses({ period: "all", status: "OVERDUE" }, db);

    assert.match(result, /Arriendo/);
    assert.doesNotMatch(result, /Supermercado/);
  });

  it("filtra por búsqueda en description y merchant", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({ search: "café", period: "all" }, db);

    assert.match(result, /Café/);
    assert.doesNotMatch(result, /Supermercado/);
  });

  it("filtra por búsqueda en merchant", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({ search: "ANDRES", period: "all" }, db);

    assert.match(result, /Restaurante ANDRES/);
  });

  it("filtra por período this_month con rango explícito", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({
      start_date: "2026-03-01",
      end_date: "2026-03-31",
    }, db);

    assert.match(result, /2026-03-28/);
    assert.match(result, /2026-03-27/);
    assert.doesNotMatch(result, /2026-02-15/);
  });

  it("filtra por período last_month con rango explícito", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({
      start_date: "2026-02-01",
      end_date: "2026-02-28",
    }, db);

    assert.match(result, /2026-02-15/);
    assert.doesNotMatch(result, /2026-03-28/);
  });

  it("filtra por período all sin aplicar filtro de fecha", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({ period: "all" }, db);

    assert.match(result, /2026-03-28/);
    assert.match(result, /2026-03-27/);
    assert.match(result, /2026-02-15/);
  });

  it("filtra por rango de fechas start_date y end_date", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({
      start_date: "2026-03-20",
      end_date: "2026-03-28",
    }, db);

    assert.match(result, /2026-03-28/);
    assert.match(result, /2026-03-27/);
    assert.doesNotMatch(result, /2026-02-15/);
  });

  it("lanza error si hay start_date sin end_date", () => {
    const db = createTestDb();
    seedExpenses(db);

    assert.throws(
      () => executeListExpenses({ start_date: "2026-03-01" }, db),
      /start_date.*end_date/,
    );
  });

  it("lanza error si hay end_date sin start_date", () => {
    const db = createTestDb();
    seedExpenses(db);

    assert.throws(
      () => executeListExpenses({ end_date: "2026-03-28" }, db),
      /end_date.*start_date/,
    );
  });

  it("lanza error si start_date > end_date", () => {
    const db = createTestDb();
    seedExpenses(db);

    assert.throws(
      () => executeListExpenses({ start_date: "2026-03-28", end_date: "2026-03-01" }, db),
      /start_date cannot be greater/,
    );
  });

  it("soporta paginación con limit y offset", () => {
    const db = createTestDb();
    seedExpenses(db);

    const page1 = executeListExpenses({ period: "all", limit: 2, offset: 0 }, db);
    const page2 = executeListExpenses({ period: "all", limit: 2, offset: 2 }, db);

    assert.match(page1, /2026-03-28/);
    assert.doesNotMatch(page1, /2026-02-15/);
    assert.match(page2, /2026-03-01/);
    assert.doesNotMatch(page2, /2026-03-28/);
  });

  it("reporta total correcto aunque la página esté truncada", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({ period: "all", limit: 2, offset: 0 }, db);

    assert.match(result, /5 total/);
  });

  it("retorna lista vacía con total correcto cuando offset está fuera del rango", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({ period: "all", limit: 10, offset: 100 }, db);

    assert.match(result, /total: 5/);
    assert.match(result, /No expenses on the requested page/);
  });

  it("incluye ID utilizable en la salida", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({ period: "all" }, db);

    assert.match(result, /ID: [a-f0-9-]{36}/);
  });

  it("filtra por source (MANUAL)", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({ period: "all", source: "MANUAL" }, db);

    assert.match(result, /Expenses/);
  });

  it("combina múltiples filtros", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({
      start_date: "2026-03-01",
      end_date: "2026-03-31",
      category: "TRANSPORT",
    }, db);

    assert.match(result, /Uber/);
    assert.doesNotMatch(result, /Supermercado/);
  });

  it("muestra hint de paginación cuando hay más resultados", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({ period: "all", limit: 2, offset: 0 }, db);

    assert.match(result, /offset=2/);
  });

  it("muestra mensaje de fin cuando no hay más resultados", () => {
    const db = createTestDb();
    seedExpenses(db);

    const result = executeListExpenses({ period: "all", limit: 10, offset: 4 }, db);

    assert.match(result, /End of results/);
  });
});
