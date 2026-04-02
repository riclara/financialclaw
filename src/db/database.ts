import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

import { ALL_MIGRATIONS, ALL_SEEDS } from "./schema.js";

const DEFAULT_DB_PATH = join(homedir(), ".openclaw", "workspace", "financialclaw.db");

let _db: DatabaseSync | undefined;
let _dbPath: string | undefined;

function shouldIgnoreMigrationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message;
  return /duplicate column name: (updated_at|status|failure_code)/i.test(message);
}

function runMigrations(db: DatabaseSync): void {
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

function initializeDb(db: DatabaseSync): void {
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  db.exec("BEGIN");
  try {
    runMigrations(db);

    for (const sql of ALL_SEEDS) {
      db.exec(sql);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function configureDb(dbPath: string): void {
  if (_db !== undefined) {
    throw new Error(
      "Cannot reconfigure the database after the singleton has been initialized.",
    );
  }

  _dbPath = dbPath;
}

export function getDb(): DatabaseSync {
  if (_db === undefined) {
    _dbPath = _dbPath ?? process.env.FINANCIALCLAW_DB_PATH ?? DEFAULT_DB_PATH;
    mkdirSync(dirname(_dbPath), { recursive: true });
    _db = new DatabaseSync(_dbPath);
    initializeDb(_db);
  }

  return _db;
}
