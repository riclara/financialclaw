import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeManageFund } from "../../src/tools/manage-fund.js";
import { createTestDb } from "../helpers/test-db.js";

interface FundRecord {
  id: string;
  name: string;
  type: string;
  currency: string;
  initial_balance: number;
  contribution_amount: number | null;
  contribution_frequency: string | null;
  contribution_interval_days: number | null;
  contribution_required: number;
  contribution_starts_on: string | null;
  target_amount: number | null;
  target_date: string | null;
  is_active: number;
}

interface FundTransactionRecord {
  fund_id: string;
  type: string;
  amount: number;
  date: string;
  notes: string | null;
}

function insertCop(db: ReturnType<typeof createTestDb>): void {
  db.prepare(
    `
      INSERT OR IGNORE INTO currencies (code, name, symbol, is_default)
      VALUES ('COP', 'Peso colombiano', '$', 0)
    `,
  ).run();
}

function createCopFund(db: ReturnType<typeof createTestDb>, name = "Emergency Fund"): FundRecord {
  insertCop(db);

  executeManageFund(
    {
      action: "create",
      name,
      type: "savings",
      currency: "COP",
      initial_balance: 1_000,
    },
    db,
  );

  return db
    .prepare(
      `
        SELECT
          id,
          name,
          type,
          currency,
          initial_balance,
          contribution_amount,
          contribution_frequency,
          contribution_interval_days,
          contribution_required,
          contribution_starts_on,
          target_amount,
          target_date,
          is_active
        FROM funds
        ORDER BY created_at ASC, id ASC
        LIMIT 1
      `,
    )
    .get() as FundRecord;
}

describe("manage_fund", () => {
  it("create persiste un fondo sin contribución con saldo inicial correcto", () => {
    const db = createTestDb();
    insertCop(db);

    const result = executeManageFund(
      {
        action: "create",
        name: "Emergency Fund",
        type: "savings",
        currency: "COP",
        initial_balance: 300_000,
      },
      db,
    );

    assert.ok(result.includes("Fund created: Emergency Fund (savings)"));
    assert.ok(result.includes("Balance: $300.000 COP"));

    const row = db
      .prepare(
        `
          SELECT
            id,
            name,
            type,
            currency,
            initial_balance,
            contribution_amount,
            contribution_frequency,
            contribution_interval_days,
            contribution_required,
            contribution_starts_on,
            target_amount,
            target_date,
            is_active
          FROM funds
          LIMIT 1
        `,
      )
      .get() as FundRecord;

    assert.equal(typeof row.id, "string");
    assert.equal(row.name, "Emergency Fund");
    assert.equal(row.type, "savings");
    assert.equal(row.currency, "COP");
    assert.equal(row.initial_balance, 300_000);
    assert.equal(row.contribution_amount, null);
    assert.equal(row.contribution_required, 0);
    assert.equal(row.is_active, 1);
  });

  it("create persiste todos los campos de una contribución fija obligatoria", () => {
    const db = createTestDb();
    insertCop(db);

    executeManageFund(
      {
        action: "create",
        name: "Brokerage",
        type: "account",
        currency: "COP",
        initial_balance: 2_500_000,
        contribution_amount: 500_000,
        contribution_frequency: "MONTHLY",
        contribution_required: true,
        contribution_starts_on: "2026-01-01",
        target_amount: 10_000_000,
        target_date: "2026-12-31",
      },
      db,
    );

    const row = db
      .prepare(
        `
          SELECT
            name,
            type,
            currency,
            initial_balance,
            contribution_amount,
            contribution_frequency,
            contribution_interval_days,
            contribution_required,
            contribution_starts_on,
            target_amount,
            target_date,
            is_active
          FROM funds
          LIMIT 1
        `,
      )
      .get() as Omit<FundRecord, "id">;

    assert.deepEqual({ ...row }, {
      name: "Brokerage",
      type: "account",
      currency: "COP",
      initial_balance: 2_500_000,
      contribution_amount: 500_000,
      contribution_frequency: "MONTHLY",
      contribution_interval_days: null,
      contribution_required: 1,
      contribution_starts_on: "2026-01-01",
      target_amount: 10_000_000,
      target_date: "2026-12-31",
      is_active: 1,
    });
  });

  it("create falla si contribution_required es true sin contribution_amount", () => {
    const db = createTestDb();
    insertCop(db);

    assert.throws(
      () =>
        executeManageFund(
          {
            action: "create",
            name: "Invalid Fund",
            type: "savings",
            currency: "COP",
            contribution_required: true,
          },
          db,
        ),
      /required contribution|contribution_amount/i,
    );
  });

  it("create falla si contribution_amount llega sin contribution_frequency", () => {
    const db = createTestDb();
    insertCop(db);

    assert.throws(
      () =>
        executeManageFund(
          {
            action: "create",
            name: "Brokerage",
            type: "account",
            currency: "COP",
            contribution_amount: 500_000,
            contribution_starts_on: "2026-01-01",
          },
          db,
        ),
      /contribution_frequency/i,
    );
  });

  it("create falla si contribution_amount llega sin contribution_starts_on", () => {
    const db = createTestDb();
    insertCop(db);

    assert.throws(
      () =>
        executeManageFund(
          {
            action: "create",
            name: "Brokerage",
            type: "account",
            currency: "COP",
            contribution_amount: 500_000,
            contribution_frequency: "MONTHLY",
          },
          db,
        ),
      /contribution_starts_on/i,
    );
  });

  it("create falla si frequency INTERVAL_DAYS llega sin contribution_interval_days", () => {
    const db = createTestDb();
    insertCop(db);

    assert.throws(
      () =>
        executeManageFund(
          {
            action: "create",
            name: "Cuota trimestral",
            type: "savings",
            currency: "COP",
            contribution_amount: 300_000,
            contribution_frequency: "INTERVAL_DAYS",
            contribution_starts_on: "2026-01-01",
          },
          db,
        ),
      /contribution_interval_days/i,
    );
  });

  it("create falla si llegan campos de contribución sin contribution_amount", () => {
    const db = createTestDb();
    insertCop(db);

    assert.throws(
      () =>
        executeManageFund(
          {
            action: "create",
            name: "Brokerage",
            type: "account",
            currency: "COP",
            contribution_frequency: "MONTHLY",
            contribution_starts_on: "2026-01-01",
          },
          db,
        ),
      /contribution_amount/i,
    );
  });

  it("create falla con fecha sintácticamente válida pero imposible en el calendario", () => {
    const db = createTestDb();
    insertCop(db);

    assert.throws(
      () =>
        executeManageFund(
          {
            action: "create",
            name: "Brokerage",
            type: "account",
            currency: "COP",
            contribution_amount: 500_000,
            contribution_frequency: "MONTHLY",
            contribution_starts_on: "2026-02-30",
          },
          db,
        ),
      /not a valid calendar date/i,
    );
  });

  it("list muestra el saldo calculado como initial más depósitos menos retiros", () => {
    const db = createTestDb();
    const fund = createCopFund(db);

    executeManageFund(
      {
        action: "deposit",
        fund: fund.id,
        amount: 500,
        date: "2026-04-02",
      },
      db,
    );
    executeManageFund(
      {
        action: "withdraw",
        fund: fund.id,
        amount: 200,
        date: "2026-04-03",
      },
      db,
    );

    const result = executeManageFund({ action: "list" }, db);

    assert.ok(result.includes("Emergency Fund (savings) - COP"));
    assert.ok(result.includes("Balance: $1.300 COP"), `saldo inesperado:\n${result}`);
    assert.ok(result.includes("Contribution: variable"));
  });

  it("list devuelve un mensaje claro cuando no hay fondos", () => {
    const db = createTestDb();

    assert.equal(executeManageFund({ action: "list" }, db), "No funds registered.");
  });

  it("deposit persiste la transacción y actualiza el saldo calculado", () => {
    const db = createTestDb();
    const fund = createCopFund(db);

    const result = executeManageFund(
      {
        action: "deposit",
        fund: fund.id,
        amount: 2_000,
        date: "2026-04-10",
        notes: "Transferencia",
      },
      db,
    );

    assert.ok(result.includes("Deposit recorded for Emergency Fund: $2.000 COP on 2026-04-10."));
    assert.ok(result.includes("Current balance: $3.000 COP"));

    const row = db
      .prepare(
        `
          SELECT fund_id, type, amount, date, notes
          FROM fund_transactions
          LIMIT 1
        `,
      )
      .get() as FundTransactionRecord;

    assert.deepEqual({ ...row }, {
      fund_id: fund.id,
      type: "deposit",
      amount: 2_000,
      date: "2026-04-10",
      notes: "Transferencia",
    });
  });

  it("withdraw persiste una transacción de retiro", () => {
    const db = createTestDb();
    const fund = createCopFund(db);

    executeManageFund(
      {
        action: "withdraw",
        fund: fund.id,
        amount: 400,
        date: "2026-04-11",
      },
      db,
    );

    const row = db
      .prepare(
        `
          SELECT fund_id, type, amount, date, notes
          FROM fund_transactions
          LIMIT 1
        `,
      )
      .get() as FundTransactionRecord;

    assert.deepEqual({ ...row }, {
      fund_id: fund.id,
      type: "withdrawal",
      amount: 400,
      date: "2026-04-11",
      notes: null,
    });
  });

  it("withdraw falla cuando el fondo está inactivo", () => {
    const db = createTestDb();
    const fund = createCopFund(db);

    executeManageFund({ action: "archive", fund: fund.id }, db);

    assert.throws(
      () =>
        executeManageFund(
          {
            action: "withdraw",
            fund: fund.id,
            amount: 100,
          },
          db,
        ),
      /archived|inactive/i,
    );
  });

  it("archive desactiva el fondo sin borrarlo y lo excluye del listado", () => {
    const db = createTestDb();
    const fund = createCopFund(db);

    const result = executeManageFund({ action: "archive", fund: fund.id }, db);

    assert.equal(result, 'Fund "Emergency Fund" archived successfully.');

    const row = db
      .prepare(`SELECT is_active FROM funds WHERE id = ?`)
      .get(fund.id) as { is_active: number };

    assert.equal(row.is_active, 0);
    assert.equal(executeManageFund({ action: "list" }, db), "No funds registered.");
  });

  it("resuelve el fondo por nombre de forma case-insensitive", () => {
    const db = createTestDb();
    const fund = createCopFund(db, "Bancolombia");

    executeManageFund(
      {
        action: "deposit",
        fund: "bancolombia",
        amount: 750,
        date: "2026-04-12",
      },
      db,
    );

    const row = db
      .prepare(`SELECT fund_id, type, amount FROM fund_transactions LIMIT 1`)
      .get() as Pick<FundTransactionRecord, "fund_id" | "type" | "amount">;

    assert.deepEqual({ ...row }, {
      fund_id: fund.id,
      type: "deposit",
      amount: 750,
    });
  });

  it("lanza un error descriptivo cuando el fondo no existe", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        executeManageFund(
          {
            action: "deposit",
            fund: "missing-fund",
            amount: 100,
          },
          db,
        ),
      /No fund found/i,
    );
  });

  it("lanza error cuando un nombre coincide con múltiples fondos activos", () => {
    const db = createTestDb();
    insertCop(db);

    executeManageFund(
      {
        action: "create",
        name: "Ahorros",
        type: "savings",
        currency: "COP",
        initial_balance: 1_000,
      },
      db,
    );
    executeManageFund(
      {
        action: "create",
        name: "Ahorros",
        type: "account",
        currency: "COP",
        initial_balance: 2_000,
      },
      db,
    );

    assert.throws(
      () =>
        executeManageFund(
          {
            action: "deposit",
            fund: "Ahorros",
            amount: 100,
          },
          db,
        ),
      /ambiguous/i,
    );
  });
});
