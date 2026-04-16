import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { DatabaseSync } from "node:sqlite";

import { ALL_MIGRATIONS, ALL_SEEDS } from "../../src/db/schema.js";
import { createTestDb } from "../helpers/test-db.js";

function shouldIgnoreMigrationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message;
  return /duplicate column name: (updated_at|status|failure_code)/i.test(message);
}

function applyMigrationsAndSeeds(db: DatabaseSync): void {
  for (const sql of ALL_MIGRATIONS) {
    try {
      db.exec(sql);
    } catch (error) {
      if (!shouldIgnoreMigrationError(error)) {
        throw error;
      }
    }
  }

  for (const sql of ALL_SEEDS) {
    db.exec(sql);
  }
}

describe("database", () => {
  it("crea el schema completo en memoria con las tablas base esperadas", () => {
    const db = createTestDb();

    const tables = db
      .prepare(
        `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `,
      )
      .all() as Array<{ name: string }>;

    assert.deepEqual(
      tables.map((table) => table.name),
      [
        "currencies",
        "expenses",
        "fund_transactions",
        "funds",
        "income_receipts",
        "incomes",
        "ocr_extractions",
        "recurring_expense_rules",
        "reminders",
      ],
    );

    const indexes = db
      .prepare(
        `
          SELECT name, sql
          FROM sqlite_master
          WHERE type = 'index'
            AND name IN (
              'idx_expenses_recurring_rule_due_date',
              'idx_reminders_expense_schedule_days_before'
            )
          ORDER BY name
        `,
      )
      .all() as Array<{ name: string; sql: string | null }>;

    assert.deepEqual(
      indexes.map((index) => index.name),
      [
        "idx_expenses_recurring_rule_due_date",
        "idx_reminders_expense_schedule_days_before",
      ],
    );
    assert.match(
      indexes[0]?.sql ?? "",
      /CREATE UNIQUE INDEX idx_expenses_recurring_rule_due_date[\s\S]*WHERE recurring_rule_id IS NOT NULL$/,
    );
    assert.match(
      indexes[1]?.sql ?? "",
      /CREATE UNIQUE INDEX idx_reminders_expense_schedule_days_before[\s\S]*ON reminders \(expense_id, scheduled_date, days_before\)$/,
    );

    const expenseColumns = db
      .prepare("PRAGMA table_info(expenses)")
      .all() as Array<{ name: string; notnull: number; dflt_value: string | null }>;
    const updatedAtColumn = expenseColumns.find((column) => column.name === "updated_at");

    assert.ok(updatedAtColumn);
    assert.equal(updatedAtColumn.name, "updated_at");
    assert.equal(updatedAtColumn.notnull, 1);
    assert.equal(updatedAtColumn.dflt_value, "datetime('now')");

    const ocrExtractionsColumns = db
      .prepare("PRAGMA table_info(ocr_extractions)")
      .all() as Array<{ name: string; notnull: number; dflt_value: string | null }>;

    const statusColumn = ocrExtractionsColumns.find((column) => column.name === "status");
    assert.ok(statusColumn, "Columna 'status' debe existir en ocr_extractions");
    assert.equal(statusColumn.name, "status");
    assert.equal(statusColumn.notnull, 1);
    assert.equal(statusColumn.dflt_value, "'COMPLETED'");

    const failureCodeColumn = ocrExtractionsColumns.find((column) => column.name === "failure_code");
    assert.ok(failureCodeColumn, "Columna 'failure_code' debe existir en ocr_extractions");
    assert.equal(failureCodeColumn.name, "failure_code");
    assert.equal(failureCodeColumn.notnull, 0);
  });

  it("reaplica migraciones y seeds sin duplicar la moneda placeholder", () => {
    const db = createTestDb();

    applyMigrationsAndSeeds(db);

    const placeholderCurrency = db
      .prepare(
        `
          SELECT code, name, symbol, is_default
          FROM currencies
          WHERE code = 'XXX'
        `,
      )
      .get() as
      | {
          code: string;
          name: string;
          symbol: string;
          is_default: number;
        }
      | undefined;

    const placeholderCount = db
      .prepare("SELECT COUNT(*) AS count FROM currencies WHERE code = 'XXX'")
      .get() as { count: number };

    assert.deepEqual({ ...placeholderCurrency }, {
      code: "XXX",
      name: "Sin configurar",
      symbol: "¤",
      is_default: 1,
    });
    assert.equal(placeholderCount.count, 1);
  });

  it("migra una tabla expenses legacy y agrega updated_at sin perder datos", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");

    db.exec(`
      CREATE TABLE currencies (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE ocr_extractions (
        id TEXT PRIMARY KEY
      );

      CREATE TABLE recurring_expense_rules (
        id TEXT PRIMARY KEY,
        currency TEXT NOT NULL,
        FOREIGN KEY (currency) REFERENCES currencies (code)
      );

      CREATE TABLE expenses (
        id TEXT PRIMARY KEY,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL,
        category TEXT,
        merchant TEXT,
        description TEXT NOT NULL,
        due_date TEXT NOT NULL,
        payment_date TEXT,
        status TEXT NOT NULL,
        source TEXT NOT NULL,
        ocr_extraction_id TEXT,
        recurring_rule_id TEXT,
        generated_from_rule INTEGER NOT NULL DEFAULT 0 CHECK (generated_from_rule IN (0, 1)),
        is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (currency) REFERENCES currencies (code),
        FOREIGN KEY (ocr_extraction_id) REFERENCES ocr_extractions (id),
        FOREIGN KEY (recurring_rule_id) REFERENCES recurring_expense_rules (id)
      );

      INSERT INTO currencies (code, name, symbol, is_default, created_at)
      VALUES ('XXX', 'Sin configurar', '¤', 1, '2026-03-28T00:00:00.000Z');

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
        created_at
      ) VALUES (
        'expense-legacy',
        1000,
        'XXX',
        'OTHER',
        NULL,
        'Pago legacy',
        '2026-03-28',
        NULL,
        'PENDING',
        'MANUAL',
        NULL,
        NULL,
        0,
        1,
        '2026-03-20T10:00:00.000Z'
      );
    `);

    applyMigrationsAndSeeds(db);

    const updatedAtColumn = db
      .prepare("PRAGMA table_info(expenses)")
      .all() as Array<{ name: string }>;
    const migratedExpense = db
      .prepare("SELECT created_at, updated_at FROM expenses WHERE id = 'expense-legacy'")
      .get() as { created_at: string; updated_at: string };

    assert.ok(updatedAtColumn.some((column) => column.name === "updated_at"));
    assert.equal(migratedExpense.updated_at, migratedExpense.created_at);
  });

  it("migra una tabla ocr_extractions legacy y agrega status y failure_code sin perder datos", () => {
    const db = new DatabaseSync(":memory:");
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");

    db.exec(`
      CREATE TABLE currencies (
        code TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        symbol TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE ocr_extractions (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        source_path TEXT,
        raw_text TEXT,
        suggested_amount INTEGER,
        suggested_currency TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO currencies (code, name, symbol, is_default, created_at)
      VALUES ('XXX', 'Sin configurar', '¤', 1, '2026-03-28T00:00:00.000Z');

      INSERT INTO ocr_extractions (
        id,
        provider,
        source_path,
        raw_text,
        suggested_amount,
        suggested_currency,
        created_at
      ) VALUES (
        'ocr-legacy-1',
        'paddleocr',
        '/path/to/receipt.jpg',
        'TOTAL $54.900',
        54900,
        'XXX',
        '2026-03-28T10:00:00.000Z'
      );
    `);

    applyMigrationsAndSeeds(db);

    const ocrColumns = db
      .prepare("PRAGMA table_info(ocr_extractions)")
      .all() as Array<{ name: string; notnull: number; dflt_value: string | null }>;

    const hasStatus = ocrColumns.some((column) => column.name === "status");
    const hasFailureCode = ocrColumns.some((column) => column.name === "failure_code");

    assert.ok(hasStatus, "Columna 'status' debe haber sido añadida por migración");
    assert.ok(hasFailureCode, "Columna 'failure_code' debe haber sido añadida por migración");

    const migratedOcr = db
      .prepare("SELECT id, provider, raw_text, status, failure_code FROM ocr_extractions WHERE id = 'ocr-legacy-1'")
      .get() as {
        id: string;
        provider: string;
        raw_text: string;
        status: string;
        failure_code: string | null;
      };

    assert.equal(migratedOcr.id, "ocr-legacy-1");
    assert.equal(migratedOcr.provider, "paddleocr");
    assert.equal(migratedOcr.raw_text, "TOTAL $54.900");
    assert.equal(migratedOcr.status, "COMPLETED");
    assert.equal(migratedOcr.failure_code, null);
  });

  it("crea la base configurada con pragmas de producción y bloquea configureDb tardío", async () => {
    const tempDir = mkdtempSync(join(tmpdir(), "financialclaw-db-"));
    const dbPath = join(tempDir, "financialclaw.sqlite");
    const databaseModule = await import("../../src/db/database.js");

    assert.ok(!("default" in databaseModule));

    databaseModule.configureDb(dbPath);
    const db = databaseModule.getDb();

    assert.ok(existsSync(dbPath));
    assert.equal(databaseModule.getDb(), db);
    assert.equal((db.prepare("PRAGMA journal_mode").get() as { journal_mode: string }).journal_mode, "wal");
    assert.equal((db.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number }).foreign_keys, 1);

    assert.throws(
      () => databaseModule.configureDb(join(tempDir, "otra.sqlite")),
      /Cannot reconfigure the database after the singleton has been initialized\./,
    );
  });
});
