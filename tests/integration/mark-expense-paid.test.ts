import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeMarkExpensePaid } from "../../src/tools/mark-expense-paid.js";
import { createTestDb } from "../helpers/test-db.js";

const FIXED_NOW = "2026-03-28T12:34:56.000Z";

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

function insertExpense(
  db: ReturnType<typeof createTestDb>,
  {
    id,
    status,
    dueDate,
    paymentDate = null,
    updatedAt = "2026-03-20T10:00:00.000Z",
  }: {
    id: string;
    status: string;
    dueDate: string;
    paymentDate?: string | null;
    updatedAt?: string;
  },
): void {
  db.prepare(
    `
      INSERT INTO expenses (
        id,
        amount,
        currency,
        category,
        merchant,
        description,
        due_date,
        payment_date,
        status,
        source,
        ocr_extraction_id,
        recurring_rule_id,
        generated_from_rule,
        is_active,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
  ).run(
    id,
    15000,
    "XXX",
    "OTHER",
    "Comercio de prueba",
    "Gasto de prueba",
    dueDate,
    paymentDate,
    status,
    "MANUAL",
    null,
    null,
    0,
    1,
    "2026-03-20T09:00:00.000Z",
    updatedAt,
  );
}

describe("mark_expense_paid", () => {
  it("marca un gasto PENDING como PAID y actualiza payment_date y updated_at", () => {
    const db = createTestDb();
    insertExpense(db, {
      id: "expense-pending",
      status: "PENDING",
      dueDate: "2026-03-30",
    });

    const result = withFixedDate(() =>
      executeMarkExpensePaid(
        { expense_id: "expense-pending", payment_date: "2026-03-29" },
        db,
      ),
    );

    const expense = db
      .prepare("SELECT status, payment_date, updated_at FROM expenses WHERE id = ?")
      .get("expense-pending") as {
      status: string;
      payment_date: string | null;
      updated_at: string;
    };

    assert.equal(result, 'Gasto "expense-pending" marcado como pagado con fecha 2026-03-29.');
    assert.equal(expense.status, "PAID");
    assert.equal(expense.payment_date, "2026-03-29");
    assert.equal(expense.updated_at, FIXED_NOW);
  });

  it("marca un gasto OVERDUE como PAID y actualiza updated_at explícitamente", () => {
    const db = createTestDb();
    insertExpense(db, {
      id: "expense-overdue",
      status: "OVERDUE",
      dueDate: "2026-03-10",
      updatedAt: "2026-03-11T08:00:00.000Z",
    });

    const result = withFixedDate(() =>
      executeMarkExpensePaid(
        { expense_id: "expense-overdue", payment_date: "2026-03-28" },
        db,
      ),
    );

    const expense = db
      .prepare("SELECT status, payment_date, updated_at FROM expenses WHERE id = ?")
      .get("expense-overdue") as {
      status: string;
      payment_date: string | null;
      updated_at: string;
    };

    assert.equal(result, 'Gasto "expense-overdue" marcado como pagado con fecha 2026-03-28.');
    assert.equal(expense.status, "PAID");
    assert.equal(expense.payment_date, "2026-03-28");
    assert.equal(expense.updated_at, FIXED_NOW);
  });

  it("lanza error descriptivo cuando el expense_id no existe", () => {
    const db = createTestDb();

    assert.throws(
      () => executeMarkExpensePaid({ expense_id: "expense-missing" }, db),
      /No existe un gasto con el ID "expense-missing"\./,
    );
  });

  it("retorna un mensaje informativo si el gasto ya está PAID y no lo muta", () => {
    const db = createTestDb();
    insertExpense(db, {
      id: "expense-paid",
      status: "PAID",
      dueDate: "2026-03-15",
      paymentDate: "2026-03-15",
      updatedAt: "2026-03-15T07:45:00.000Z",
    });

    const result = withFixedDate(() =>
      executeMarkExpensePaid(
        { expense_id: "expense-paid", payment_date: "2026-03-28" },
        db,
      ),
    );

    const expense = db
      .prepare("SELECT status, payment_date, updated_at FROM expenses WHERE id = ?")
      .get("expense-paid") as {
      status: string;
      payment_date: string | null;
      updated_at: string;
    };

    assert.equal(result, 'El gasto "expense-paid" ya estaba marcado como pagado.');
    assert.equal(expense.status, "PAID");
    assert.equal(expense.payment_date, "2026-03-15");
    assert.equal(expense.updated_at, "2026-03-15T07:45:00.000Z");
  });

  it("usa hoy como payment_date cuando se omite", () => {
    const db = createTestDb();
    insertExpense(db, {
      id: "expense-default-date",
      status: "PENDING",
      dueDate: "2026-03-31",
      updatedAt: "2026-03-21T09:30:00.000Z",
    });

    const result = withFixedDate(() =>
      executeMarkExpensePaid({ expense_id: "expense-default-date" }, db),
    );

    const expense = db
      .prepare("SELECT status, payment_date, updated_at FROM expenses WHERE id = ?")
      .get("expense-default-date") as {
      status: string;
      payment_date: string | null;
      updated_at: string;
    };

    assert.equal(
      result,
      'Gasto "expense-default-date" marcado como pagado con fecha 2026-03-28.',
    );
    assert.equal(expense.status, "PAID");
    assert.equal(expense.payment_date, "2026-03-28");
    assert.equal(expense.updated_at, FIXED_NOW);
  });
});
