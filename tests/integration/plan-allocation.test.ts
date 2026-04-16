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

function insertFund(
  db: ReturnType<typeof createTestDb>,
  opts: {
    name: string;
    type?: "savings" | "account";
    currency: string;
    initialBalance?: number;
    contributionAmount?: number | null;
    contributionFrequency?: string | null;
    contributionIntervalDays?: number | null;
    contributionRequired?: boolean;
    contributionStartsOn?: string | null;
    targetAmount?: number | null;
    targetDate?: string | null;
    isActive?: boolean;
  },
): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO funds (
      id, name, type, currency, initial_balance, contribution_amount,
      contribution_frequency, contribution_interval_days, contribution_required,
      contribution_starts_on, target_amount, target_date, is_active, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    opts.name,
    opts.type ?? "savings",
    opts.currency,
    opts.initialBalance ?? 0,
    opts.contributionAmount ?? null,
    opts.contributionFrequency ?? null,
    opts.contributionIntervalDays ?? null,
    opts.contributionRequired === true ? 1 : 0,
    opts.contributionStartsOn ?? null,
    opts.targetAmount ?? null,
    opts.targetDate ?? null,
    opts.isActive === false ? 0 : 1,
    now,
  );

  return id;
}

function insertFundTransaction(
  db: ReturnType<typeof createTestDb>,
  opts: {
    fundId: string;
    type: "deposit" | "withdrawal";
    amount: number;
    date: string;
    notes?: string;
  },
): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO fund_transactions (id, fund_id, type, amount, date, notes, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, opts.fundId, opts.type, opts.amount, opts.date, opts.notes ?? null, now);

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

    insertRule(db, {
      currency: "COP",
      amount: 200_000,
      name: "Regla expirada",
      frequency: "MONTHLY",
      startsOn: "2020-01-01",
      endsOn: "2020-12-31", // claramente en el pasado
    });

    const result = executePlanAllocation({ amount: 2_000_000, currency: "COP" }, db);
    assert.ok(!result.includes("Regla expirada"), "regla expirada no debe aparecer");
    assert.ok(
      result.includes("No pending commitments") || !result.includes("(estimated)"),
      "no debe incluir la regla expirada como estimada",
    );
  });

  it("regla INTERVAL_DAYS con ciclo que salta el mes actual: no se incluye", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    // Regla cada 40 días comenzando el día anterior al mes actual.
    // La ocurrencia siguiente cae a monthStart + 39 días, es decir fuera del mes
    // en cualquier calendario (meses ≤ 31 días). No hay ciclo en el mes actual.
    const today = todayISO();
    const [y, m] = today.split("-").map(Number);
    const priorMs = Date.UTC(y, m - 1, 1) - 86_400_000;
    const prior = new Date(priorMs);
    const startsOn = `${prior.getUTCFullYear()}-${String(prior.getUTCMonth() + 1).padStart(2, "0")}-${String(prior.getUTCDate()).padStart(2, "0")}`;

    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO recurring_expense_rules (
        id, name, amount, currency, frequency, starts_on, interval_days, is_active, created_at
      ) VALUES (?, ?, ?, ?, 'INTERVAL_DAYS', ?, 40, 1, ?)`,
    ).run(id, "Cuota trimestral", 300_000, "COP", startsOn, now);

    const result = executePlanAllocation({ amount: 2_000_000, currency: "COP" }, db);

    assert.ok(
      !result.includes("Cuota trimestral"),
      "regla cuya ocurrencia cae fuera del mes no debe aparecer",
    );
    assert.ok(
      !result.includes("(estimated)"),
      "no debe listar la regla como estimada cuando su ciclo salta el mes",
    );
    assert.ok(
      result.includes("No pending commitments"),
      "sin otras deudas, el mes debe reportarse sin compromisos",
    );
  });

  it("fondo obligatorio sin depósito este mes: aparece en compromisos y reduce disponible", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    insertFund(db, {
      name: "Fondo emergencia",
      type: "savings",
      currency: "COP",
      contributionAmount: 500_000,
      contributionFrequency: "MONTHLY",
      contributionRequired: true,
      contributionStartsOn: monthStart(),
    });

    const result = executePlanAllocation({ amount: 4_000_000, currency: "COP" }, db);

    assert.ok(result.includes("Pending commitments this month:"), "debe mostrar pendientes");
    assert.ok(result.includes("Fondo emergencia"), "debe listar el fondo");
    assert.ok(result.includes("(savings - required)"), "debe etiquetar el tipo requerido");
    assert.ok(result.includes(`due ${monthStart()}`), "debe estimar fecha del mes actual");
    assert.ok(result.includes("Available: $3.500.000 COP"), "debe descontar el aporte del disponible");
    assert.ok(!result.includes("Already saved this month:"), "no debe marcarlo como ya aportado");
  });

  it("fondo con contribution_starts_on futuro: no aparece como compromiso del mes actual", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    // Fondo que empieza el mes que viene — no debe aparecer en compromisos de este mes
    const today = todayISO();
    const [year, month] = today.split("-").map(Number);
    const nextMonth = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    insertFund(db, {
      name: "Fondo futuro",
      type: "savings",
      currency: "COP",
      contributionAmount: 300_000,
      contributionFrequency: "MONTHLY",
      contributionRequired: true,
      contributionStartsOn: nextMonth,
    });

    const result = executePlanAllocation({ amount: 2_000_000, currency: "COP" }, db);

    assert.ok(!result.includes("Fondo futuro"), "fondo con starts_on futuro no debe aparecer");
    assert.ok(result.includes("No pending commitments") || !result.includes("(savings - required)"),
      "no debe inflar los compromisos del mes actual");
  });

  it("fondo obligatorio con depósito ya realizado: aparece en Already saved y no en pendientes", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    const fundId = insertFund(db, {
      name: "Vacaciones",
      type: "account",
      currency: "COP",
      contributionAmount: 200_000,
      contributionFrequency: "MONTHLY",
      contributionRequired: true,
      contributionStartsOn: monthStart(),
    });
    insertFundTransaction(db, {
      fundId,
      type: "deposit",
      amount: 200_000,
      date: todayISO(),
    });

    const result = executePlanAllocation({ amount: 2_000_000, currency: "COP" }, db);

    assert.ok(result.includes("Already saved this month:"), "debe mostrar sección de ahorros realizados");
    assert.ok(result.includes("Vacaciones"), "debe listar el fondo");
    assert.ok(result.includes("saved"), "debe marcar la fecha del ahorro");
    assert.ok(!result.includes("(account - required)"), "no debe aparecer como compromiso pendiente");
    assert.ok(
      result.includes("No pending commitments this month."),
      "sin otros compromisos debe quedar el output base",
    );
  });

  it("fondo obligatorio ya aportado: muestra el monto real depositado, no el configurado", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    const fundId = insertFund(db, {
      name: "Emergencia",
      type: "savings",
      currency: "COP",
      contributionAmount: 500_000, // monto configurado
      contributionFrequency: "MONTHLY",
      contributionRequired: true,
      contributionStartsOn: monthStart(),
    });
    // Depósito real distinto al configurado
    insertFundTransaction(db, { fundId, type: "deposit", amount: 300_000, date: todayISO() });

    const result = executePlanAllocation({ amount: 2_000_000, currency: "COP" }, db);

    assert.ok(result.includes("Already saved this month:"), "debe mostrar sección de ahorros");
    // El total debe reflejar el depósito real (300k), no el configurado (500k)
    assert.ok(result.includes("300"), "debe mostrar el monto real depositado");
    assert.ok(!result.includes("500.000"), "no debe mostrar el monto configurado como si fuera el depositado");
  });

  it("fondo opcional fijo: aparece en Suggested savings con saldo y progreso", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    const fundId = insertFund(db, {
      name: "Fondo viaje",
      currency: "COP",
      initialBalance: 500_000,
      contributionAmount: 300_000,
      contributionFrequency: "MONTHLY",
      contributionRequired: false,
      contributionStartsOn: monthStart(),
      targetAmount: 2_000_000,
    });
    insertFundTransaction(db, {
      fundId,
      type: "deposit",
      amount: 300_000,
      date: todayISO(),
    });

    const result = executePlanAllocation({ amount: 4_000_000, currency: "COP" }, db);

    assert.ok(result.includes("Suggested savings:"), "debe mostrar sección sugerida");
    assert.ok(result.includes("Fondo viaje"), "debe listar el fondo");
    assert.ok(result.includes("$300.000 COP suggested"), "debe mostrar el monto sugerido");
    assert.ok(result.includes("balance: $800.000 COP"), "debe mostrar el saldo calculado");
    assert.ok(result.includes("target: $2.000.000 COP (40%)"), "debe mostrar progreso de meta");
    assert.ok(!result.includes("Available: $3.700.000 COP"), "las sugerencias no deben descontar disponible");
  });

  it("fondo variable: aparece en Variable savings con saldo actual", () => {
    const db = createTestDb();
    insertCurrency(db, "COP", "$", true);
    setDefault(db, "COP");

    const fundId = insertFund(db, {
      name: "Inversiones",
      type: "account",
      currency: "COP",
      initialBalance: 4_000_000,
      contributionAmount: null,
    });
    insertFundTransaction(db, {
      fundId,
      type: "deposit",
      amount: 2_000_000,
      date: todayISO(),
    });
    insertFundTransaction(db, {
      fundId,
      type: "withdrawal",
      amount: 1_000_000,
      date: todayISO(),
    });

    const result = executePlanAllocation({ amount: 4_000_000, currency: "COP" }, db);

    assert.ok(result.includes("Variable savings:"), "debe mostrar sección variable");
    assert.ok(result.includes("Inversiones"), "debe listar el fondo");
    assert.ok(result.includes("balance: $5.000.000 COP"), "debe mostrar saldo calculado");
    assert.ok(
      result.includes("How much do you want to set aside?"),
      "debe invitar a decidir el monto variable",
    );
  });

  it("sin fondos activos en la moneda pedida: output idéntico al comportamiento previo", () => {
    const baselineDb = createTestDb();
    const extendedDb = createTestDb();

    insertCurrency(baselineDb, "COP", "$", true);
    insertCurrency(extendedDb, "COP", "$", true);
    insertCurrency(extendedDb, "USD", "US$");
    setDefault(baselineDb, "COP");
    setDefault(extendedDb, "COP");

    const today = todayISO();
    insertExpense(baselineDb, { currency: "COP", amount: 1_500_000, description: "Arriendo", dueDate: today });
    insertExpense(extendedDb, { currency: "COP", amount: 1_500_000, description: "Arriendo", dueDate: today });

    insertFund(extendedDb, {
      name: "Fondo USD",
      currency: "USD",
      contributionAmount: 300,
      contributionFrequency: "MONTHLY",
      contributionRequired: true,
      contributionStartsOn: monthStart(),
    });
    insertFund(extendedDb, {
      name: "Fondo archivado",
      currency: "COP",
      contributionAmount: 200_000,
      contributionFrequency: "MONTHLY",
      contributionRequired: true,
      contributionStartsOn: monthStart(),
      isActive: false,
    });

    const baseline = executePlanAllocation({ amount: 4_000_000, currency: "COP" }, baselineDb);
    const extended = executePlanAllocation({ amount: 4_000_000, currency: "COP" }, extendedDb);

    assert.equal(extended, baseline, "sin fondos activos en COP el output debe mantenerse idéntico");
  });
});
