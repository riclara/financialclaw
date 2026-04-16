export const CREATE_CURRENCIES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS currencies (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const CREATE_OCR_EXTRACTIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ocr_extractions (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  source_path TEXT,
  raw_text TEXT,
  lines_json TEXT,
  average_confidence REAL,
  suggested_amount INTEGER,
  suggested_currency TEXT,
  suggested_date TEXT,
  suggested_merchant TEXT,
  suggested_category TEXT,
  failure_reason TEXT,
  failure_detail TEXT,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  failure_code TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

export const CREATE_RECURRING_EXPENSE_RULES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS recurring_expense_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  amount INTEGER NOT NULL,
  category TEXT,
  currency TEXT NOT NULL,
  frequency TEXT NOT NULL,
  interval_days INTEGER,
  day_of_month INTEGER,
  starts_on TEXT NOT NULL,
  ends_on TEXT,
  reminder_days_before INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (currency) REFERENCES currencies (code)
);
`;

export const CREATE_EXPENSES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS expenses (
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (currency) REFERENCES currencies (code),
  FOREIGN KEY (ocr_extraction_id) REFERENCES ocr_extractions (id),
  FOREIGN KEY (recurring_rule_id) REFERENCES recurring_expense_rules (id)
);
`;

export const ADD_EXPENSES_UPDATED_AT_COLUMN_SQL = `
ALTER TABLE expenses ADD COLUMN updated_at TEXT;
`;

export const BACKFILL_EXPENSES_UPDATED_AT_SQL = `
UPDATE expenses
SET updated_at = created_at
WHERE updated_at IS NULL;
`;

export const ADD_OCR_EXTRACTIONS_STATUS_COLUMN_SQL = `
ALTER TABLE ocr_extractions ADD COLUMN status TEXT NOT NULL DEFAULT 'COMPLETED'
`;

export const ADD_OCR_EXTRACTIONS_FAILURE_CODE_COLUMN_SQL = `
ALTER TABLE ocr_extractions ADD COLUMN failure_code TEXT
`;

export const CREATE_EXPENSES_RECURRING_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_expenses_recurring_rule_due_date
ON expenses (recurring_rule_id, due_date)
WHERE recurring_rule_id IS NOT NULL;
`;

export const CREATE_INCOMES_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS incomes (
  id TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  expected_amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  date TEXT NOT NULL,
  frequency TEXT,
  interval_days INTEGER,
  is_recurring INTEGER NOT NULL DEFAULT 0 CHECK (is_recurring IN (0, 1)),
  next_expected_receipt_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (currency) REFERENCES currencies (code)
);
`;

export const CREATE_INCOME_RECEIPTS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS income_receipts (
  id TEXT PRIMARY KEY,
  income_id TEXT NOT NULL,
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL,
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (income_id) REFERENCES incomes (id),
  FOREIGN KEY (currency) REFERENCES currencies (code)
);
`;

export const CREATE_REMINDERS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS reminders (
  id TEXT PRIMARY KEY,
  expense_id TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  days_before INTEGER NOT NULL,
  sent INTEGER NOT NULL DEFAULT 0 CHECK (sent IN (0, 1)),
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (expense_id) REFERENCES expenses (id)
);
`;

export const CREATE_REMINDERS_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_expense_schedule_days_before
ON reminders (expense_id, scheduled_date, days_before);
`;

export const CREATE_FUNDS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS funds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('savings', 'account')),
  currency TEXT NOT NULL,
  initial_balance INTEGER NOT NULL DEFAULT 0,
  contribution_amount INTEGER,
  contribution_frequency TEXT,
  contribution_interval_days INTEGER,
  contribution_required INTEGER NOT NULL DEFAULT 0 CHECK (contribution_required IN (0, 1)),
  contribution_starts_on TEXT,
  target_amount INTEGER,
  target_date TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (currency) REFERENCES currencies (code)
);
`;

export const CREATE_FUND_TRANSACTIONS_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS fund_transactions (
  id TEXT PRIMARY KEY,
  fund_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  date TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (fund_id) REFERENCES funds (id)
);
`;

export const SEED_PLACEHOLDER_CURRENCY_SQL = `
INSERT OR IGNORE INTO currencies (code, name, symbol, is_default)
VALUES ('XXX', 'Sin configurar', '¤', 1);
`;

export const ALL_MIGRATIONS = [
  CREATE_CURRENCIES_TABLE_SQL,
  CREATE_OCR_EXTRACTIONS_TABLE_SQL,
  CREATE_RECURRING_EXPENSE_RULES_TABLE_SQL,
  CREATE_EXPENSES_TABLE_SQL,
  ADD_EXPENSES_UPDATED_AT_COLUMN_SQL,
  BACKFILL_EXPENSES_UPDATED_AT_SQL,
  CREATE_EXPENSES_RECURRING_UNIQUE_INDEX_SQL,
  CREATE_INCOMES_TABLE_SQL,
  CREATE_INCOME_RECEIPTS_TABLE_SQL,
  CREATE_REMINDERS_TABLE_SQL,
  CREATE_REMINDERS_UNIQUE_INDEX_SQL,
  CREATE_FUNDS_TABLE_SQL,
  CREATE_FUND_TRANSACTIONS_TABLE_SQL,
  ADD_OCR_EXTRACTIONS_STATUS_COLUMN_SQL,
  ADD_OCR_EXTRACTIONS_FAILURE_CODE_COLUMN_SQL,
] as const;

export const ALL_SEEDS = [SEED_PLACEHOLDER_CURRENCY_SQL] as const;
