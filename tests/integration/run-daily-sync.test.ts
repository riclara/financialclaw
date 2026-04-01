import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createTestDb } from "../helpers/test-db.js";
import { executeRunDailySync } from "../../src/tools/run-daily-sync.js";
import { executeAddRecurringExpense } from "../../src/tools/add-recurring-expense.js";
import { dailySync } from "../../src/services/daily-sync.js";

function insertCop(db: ReturnType<typeof createTestDb>): void {
  db.prepare(
    `INSERT OR IGNORE INTO currencies (code, name, symbol, is_default) VALUES ('COP', 'Peso colombiano', '$', 0)`,
  ).run();
}

function setDefault(db: ReturnType<typeof createTestDb>, code: string): void {
  db.prepare(`UPDATE currencies SET is_default = 0`).run();
  db.prepare(`UPDATE currencies SET is_default = 1 WHERE code = ?`).run(code);
}

function seedRecurringRule(
  db: ReturnType<typeof createTestDb>,
  overrides: Partial<Parameters<typeof executeAddRecurringExpense>[0]> = {},
): void {
  executeAddRecurringExpense(
    {
      description: "Netflix",
      amount: 22_000,
      currency: "COP",
      frequency: "MONTHLY",
      starts_on: "2026-03-01",
      reminder_days_before: 3,
      ...overrides,
    },
    db,
  );
}

describe("run_daily_sync — integración", () => {
  it("retorna mensaje de finanzas al día cuando no hay recurrentes", () => {
    const db = createTestDb();
    const result = executeRunDailySync({}, db);

    assert.ok(result.includes("Sync diario completado"), "debe incluir cabecera");
    assert.ok(result.includes("al día"), "debe indicar que no hay pendientes");
  });

  it("genera gastos recurrentes y los reporta correctamente", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");
    seedRecurringRule(db, { starts_on: "2026-01-01" });

    // Simulamos que el sync corre varios meses después — el tool usa la fecha real,
    // así que forzamos el estado insertando directamente vía dailySync con fecha pasada
    // y luego corremos el tool para verificar el formato de salida.
    dailySync(db, "2026-02-01");

    const result = executeRunDailySync({}, db);

    assert.ok(result.includes("Sync diario completado"), "debe incluir cabecera");
    assert.ok(
      result.includes("Gastos recurrentes generados"),
      "debe reportar gastos generados",
    );
  });

  it("lista recordatorios pendientes y los marca como enviados", () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");

    // Regla que vence en 3 días con recordatorio de 3 días → reminder scheduled hoy
    const today = new Date().toISOString().slice(0, 10);
    const dueDate = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
    seedRecurringRule(db, {
      starts_on: dueDate,
      reminder_days_before: 3,
    });

    // Generamos la instancia del gasto para que el reminder quede pendiente
    dailySync(db, dueDate);

    const result = executeRunDailySync({}, db);

    assert.ok(
      result.includes("Recordatorios pendientes"),
      "debe listar recordatorios",
    );
    assert.ok(result.includes("Netflix"), "debe incluir el nombre del gasto");

    // Verifica que los reminders quedaron marcados como enviados en la BD
    const unsent = db
      .prepare(`SELECT COUNT(*) AS cnt FROM reminders WHERE sent = 0`)
      .get() as { cnt: number };

    assert.equal(unsent.cnt, 0, "todos los reminders deben quedar marcados como enviados");
  });

  it("no marca reminders como enviados si no hay ninguno pendiente", () => {
    const db = createTestDb();
    const result = executeRunDailySync({}, db);

    const sent = db
      .prepare(`SELECT COUNT(*) AS cnt FROM reminders WHERE sent = 1`)
      .get() as { cnt: number };

    assert.equal(sent.cnt, 0, "no debe haber reminders marcados si no había ninguno");
    assert.ok(result.includes("al día"), "debe indicar finanzas al día");
  });
});
