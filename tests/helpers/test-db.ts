import Database from "better-sqlite3";

import { ALL_MIGRATIONS, ALL_SEEDS } from "../../src/db/schema.js";

function shouldIgnoreMigrationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message;
  return /duplicate column name: (updated_at|status|failure_code)/i.test(message);
}

export function createTestDb(): Database.Database {
  const db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

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

  return db;
}
