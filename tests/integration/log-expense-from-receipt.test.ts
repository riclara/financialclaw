import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { executeLogExpenseFromReceipt } from "../../src/tools/log-expense-from-receipt.js";
import { createTestDb } from "../helpers/test-db.js";

// today = "2026-03-28" en la zona local cuando se usa esta fecha UTC al mediodía
const FIXED_NOW = "2026-03-28T12:00:00.000Z";

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

type ExpenseRow = {
  id: string;
  amount: number;
  currency: string;
  category: string;
  merchant: string | null;
  description: string;
  due_date: string;
  payment_date: string | null;
  status: string;
  source: string;
  created_at: string;
  updated_at: string;
};

type OcrExtractionRow = {
  id: string;
  provider: string;
  source_path: string | null;
  raw_text: string | null;
  lines_json: string | null;
  average_confidence: number | null;
  suggested_amount: number | null;
  suggested_currency: string | null;
  suggested_date: string | null;
  suggested_merchant: string | null;
  suggested_category: string | null;
  status: string;
  failure_code: string | null;
  created_at: string;
};

function getLastExpense(db: ReturnType<typeof createTestDb>): ExpenseRow {
  return db
    .prepare(
      `
        SELECT id, amount, currency, category, merchant, description,
               due_date, payment_date, status, source, created_at, updated_at
        FROM expenses
        ORDER BY created_at DESC
        LIMIT 1
      `,
    )
    .get() as ExpenseRow;
}

function getLastOcrExtraction(db: ReturnType<typeof createTestDb>): OcrExtractionRow {
  return db
    .prepare(
      `
        SELECT id, provider, source_path, raw_text, lines_json,
               average_confidence, suggested_amount, suggested_currency,
               suggested_date, suggested_merchant, suggested_category,
               status, failure_code, created_at
        FROM ocr_extractions
        ORDER BY created_at DESC
        LIMIT 1
      `,
    )
    .get() as OcrExtractionRow;
}

describe("log_expense_from_receipt", () => {
  it("caso feliz: agente envía amount, date, merchant, category, raw_text", () => {
    const db = createTestDb();

    const result = withFixedDate(() =>
      executeLogExpenseFromReceipt(
        {
          amount: 15000,
          date: "2026-03-28",
          merchant: "Supermercado",
          category: "GROCERIES",
          raw_text: "SUPERMERCADO XYZ\nTOTAL: $15.000\n28/03/2026",
          confirm: true,
        },
        db,
      ),
    );

    // Verificar que se insertó el gasto
    const expense = getLastExpense(db);
    assert.equal(expense.amount, 15000);
    assert.equal(expense.currency, "XXX"); // moneda default del seed
    assert.equal(expense.category, "GROCERIES");
    assert.equal(expense.merchant, "Supermercado");
    assert.equal(expense.description, "Expense at Supermercado"); // descripción generada
    assert.equal(expense.due_date, "2026-03-28");
    assert.equal(expense.payment_date, "2026-03-28");
    assert.equal(expense.status, "PAID");
    assert.equal(expense.source, "OCR");

    // Verificar que se insertó la extracción OCR
    const extraction = getLastOcrExtraction(db);
    assert.equal(extraction.provider, "openclaw_agent");
    assert.equal(extraction.source_path, null); // no aplica para OCR agéntico
    assert.equal(extraction.raw_text, "SUPERMERCADO XYZ\nTOTAL: $15.000\n28/03/2026");
    assert.equal(extraction.lines_json, null); // no aplica para OCR agéntico
    assert.equal(extraction.average_confidence, null); // no aplica para OCR agéntico
    assert.equal(extraction.suggested_amount, 15000);
    assert.equal(extraction.suggested_currency, "XXX");
    assert.equal(extraction.suggested_date, "2026-03-28");
    assert.equal(extraction.suggested_merchant, "Supermercado");
    assert.equal(extraction.suggested_category, "GROCERIES");
    assert.equal(extraction.status, "COMPLETED");
    assert.equal(extraction.failure_code, null);

    // Verificar respuesta
    assert.match(result, /OCR expense logged/);
    assert.match(result, /¤/); // símbolo de XXX
    assert.match(result, /15/); // parte del monto
    assert.match(result, /Supermercado/);
    assert.match(result, /\[GROCERIES\]/);
    assert.match(result, /manage_currency/); // sugerencia porque moneda es XXX
  });

  it("con currency real no muestra sugerencia de manage_currency", () => {
    const db = createTestDb();
    
    // Primero agregamos una moneda real y la establecemos como default
    db.prepare(`UPDATE currencies SET is_default = 0`).run();
    db.prepare(
      `INSERT INTO currencies (code, name, symbol, is_default) VALUES ('USD', 'US Dollar', '$', 1)`
    ).run();

    const result = withFixedDate(() =>
      executeLogExpenseFromReceipt(
        {
          amount: 1000,
          date: "2026-03-28",
          merchant: "Tienda",
          category: "SHOPPING",
          currency: "USD",
          raw_text: "TIENDA ABC\nTOTAL: $1000\n28/03/2026",
          confirm: true,
        },
        db,
      ),
    );

    // Verificar que se usó la moneda correcta
    const expense = getLastExpense(db);
    assert.equal(expense.currency, "USD");

    // Verificar que NO hay sugerencia de manage_currency
    assert.equal(result.includes("manage_currency"), false);
  });

  it("sin merchant queda null en BD", () => {
    const db = createTestDb();

    withFixedDate(() =>
      executeLogExpenseFromReceipt(
        {
          amount: 5000,
          date: "2026-03-28",
          category: "OTHER",
          raw_text: "RECIBO SIN COMERCIO\nTOTAL: $50\n28/03/2026",
          confirm: true,
        },
        db,
      ),
    );

    const expense = getLastExpense(db);
    assert.equal(expense.merchant, null);
  });

  it("sin category usa OTHER como valor por defecto", () => {
    const db = createTestDb();

    withFixedDate(() =>
      executeLogExpenseFromReceipt(
        {
          amount: 3000,
          date: "2026-03-28",
          merchant: "Cafeteria",
          raw_text: "CAFETERIA\nTOTAL: $30\n28/03/2026",
          confirm: true,
        },
        db,
      ),
    );

    const expense = getLastExpense(db);
    assert.equal(expense.category, "OTHER");
  });

  it("lanza error si amount es cero o negativo", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        withFixedDate(() =>
          executeLogExpenseFromReceipt(
            { amount: 0, date: "2026-03-28", raw_text: "TEST" },
            db,
          ),
        ),
      /amount is required and must be greater than 0/
    );

    assert.throws(
      () =>
        withFixedDate(() =>
          executeLogExpenseFromReceipt(
            { amount: -100, date: "2026-03-28", raw_text: "TEST" },
            db,
          ),
        ),
      /amount is required and must be greater than 0/
    );
  });

  it("lanza error si date no tiene formato YYYY-MM-DD", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        withFixedDate(() =>
          executeLogExpenseFromReceipt(
            { amount: 1000, date: "28/03/2026", raw_text: "TEST" },
            db,
          ),
        ),
      /date is required in YYYY-MM-DD format/
    );
  });

  it("lanza error si description tiene solo espacios", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        withFixedDate(() =>
          executeLogExpenseFromReceipt(
            { amount: 1000, date: "2026-03-28", description: "   ", raw_text: "TEST" },
            db,
          ),
        ),
      /description must not be blank/
    );
  });

  it("lanza error si merchant tiene solo espacios", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        withFixedDate(() =>
          executeLogExpenseFromReceipt(
            {
              amount: 1000,
              date: "2026-03-28",
              merchant: "   ",
              raw_text: "TEST",
            },
            db,
          ),
        ),
      /merchant must not be blank/
    );
  });

  it("lanza error si category tiene solo espacios", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        withFixedDate(() =>
          executeLogExpenseFromReceipt(
            {
              amount: 1000,
              date: "2026-03-28",
              merchant: "Tienda",
              category: "   ",
              raw_text: "TEST",
            },
            db,
          ),
        ),
      /category must not be blank/
    );
  });

  it("lanza error si raw_text tiene solo espacios", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        withFixedDate(() =>
          executeLogExpenseFromReceipt(
            {
              amount: 1000,
              date: "2026-03-28",
              merchant: "Tienda",
              raw_text: "   ",
            },
            db,
          ),
        ),
      /raw_text must not be blank/
    );
  });

  it("sin confirm devuelve preview y no escribe en BD", () => {
    const db = createTestDb();

    const before = db.prepare("SELECT COUNT(*) as c FROM expenses").get() as { c: number };

    const result = withFixedDate(() =>
      executeLogExpenseFromReceipt(
        {
          amount: 27314.81,
          date: "2026-04-21",
          merchant: "CANDILEJAS VIVA LA CEJA",
          category: "RESTAURANTE",
          raw_text: "CANDILEJAS\nTOTAL: 27.314,81",
        },
        db,
      ),
    );

    assert.match(result, /Preview/);
    assert.match(result, /27.*314/);
    assert.match(result, /2026-04-21/);
    assert.match(result, /CANDILEJAS VIVA LA CEJA/);
    assert.match(result, /RESTAURANTE/);
    assert.match(result, /confirm=true/);

    const after = db.prepare("SELECT COUNT(*) as c FROM expenses").get() as { c: number };
    assert.equal(after.c, before.c, "preview must not insert any expense");

    const extractions = db.prepare("SELECT COUNT(*) as c FROM ocr_extractions").get() as { c: number };
    assert.equal(extractions.c, 0, "preview must not insert any ocr_extraction");
  });

  it("con confirm:false explícito también devuelve preview", () => {
    const db = createTestDb();

    const result = withFixedDate(() =>
      executeLogExpenseFromReceipt(
        {
          amount: 1000,
          date: "2026-03-28",
          merchant: "Tienda",
          raw_text: "TEST",
          confirm: false,
        },
        db,
      ),
    );

    assert.match(result, /Preview/);
    const after = db.prepare("SELECT COUNT(*) as c FROM expenses").get() as { c: number };
    assert.equal(after.c, 0);
  });

  it("preview valida input antes de devolver", () => {
    const db = createTestDb();

    assert.throws(
      () =>
        withFixedDate(() =>
          executeLogExpenseFromReceipt(
            { amount: 0, date: "2026-03-28", raw_text: "TEST" },
            db,
          ),
        ),
      /amount is required and must be greater than 0/
    );
  });
});