import { DatabaseSync } from "node:sqlite";

import { ALL_MIGRATIONS, ALL_SEEDS } from "../../src/db/schema.js";

function shouldIgnoreMigrationError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  const message = error.message;
  return /duplicate column name: (updated_at|status|failure_code)/i.test(message);
}

export function createTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

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
