import Database from "better-sqlite3";

import { ALL_MIGRATIONS, ALL_SEEDS } from "./schema.js";

let _db: Database.Database | undefined;
let _dbPath: string | undefined;

function shouldIgnoreMigrationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message;
  return /duplicate column name: (updated_at|status|failure_code)/i.test(message);
}

function runMigrations(db: Database.Database): void {
  for (const sql of ALL_MIGRATIONS) {
    try {
      db.exec(sql);
    } catch (error) {
      if (!shouldIgnoreMigrationError(error)) {
        throw error;
      }
    }
  }
}

function initializeDb(db: Database.Database): void {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const setup = db.transaction(() => {
    runMigrations(db);

    for (const sql of ALL_SEEDS) {
      db.exec(sql);
    }
  });

  setup();
}

export function configureDb(dbPath: string): void {
  if (_db !== undefined) {
    throw new Error(
      "No se puede reconfigurar la base de datos después de inicializar el singleton.",
    );
  }

  _dbPath = dbPath;
}

export function getDb(): Database.Database {
  if (_db === undefined) {
    _dbPath = _dbPath ?? process.env.FINANCIALCLAW_DB_PATH ?? "./financialclaw.db";
    _db = new Database(_dbPath);
    initializeDb(_db);
  }

  return _db;
}
