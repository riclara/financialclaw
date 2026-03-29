import { randomUUID } from "node:crypto";

import Database from "better-sqlite3";

import { getDb } from "../db/database.js";
import { computeNextDate, todayISO } from "../tools/helpers/date-utils.js";

interface RecurringExpenseRuleRow {
  id: string;
  name: string;
  amount: number;
  category: string | null;
  currency: string;
  frequency: string;
  interval_days: number | null;
  starts_on: string;
  ends_on: string | null;
  reminder_days_before: number;
}

interface LastDateRow {
  last_date: string | null;
}

export interface DailySyncReminder {
  expense_id: string;
  reminder_id: string;
  description: string;
  amount: number;
  currency: string;
  due_date: string;
  days_before: number;
}

export interface DailySyncResult {
  expensesGenerated: number;
  expensesMarkedOverdue: number;
  remindersDue: DailySyncReminder[];
}

function subtractDaysFromIso(dateStr: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);

  if (match === null) {
    throw new Error(`La fecha "${dateStr}" no tiene el formato YYYY-MM-DD.`);
  }

  const [, yearPart, monthPart, dayPart] = match;
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() - days);

  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function nextDueDate(
  rule: RecurringExpenseRuleRow,
  lastGeneratedDate: string | null,
): string {
  if (lastGeneratedDate === null) {
    return rule.starts_on;
  }

  return computeNextDate(
    lastGeneratedDate,
    rule.frequency,
    rule.interval_days ?? 0,
  );
}

export function dailySync(
  db: Database.Database = getDb(),
  today = todayISO(),
): DailySyncResult {
  const selectRulesStmt = db.prepare(`
    SELECT
      id,
      name,
      amount,
      category,
      currency,
      frequency,
      interval_days,
      starts_on,
      ends_on,
      reminder_days_before
    FROM recurring_expense_rules
    WHERE is_active = 1
    ORDER BY starts_on ASC, created_at ASC
  `);

  const selectLastDateStmt = db.prepare(`
    SELECT MAX(due_date) AS last_date
    FROM expenses
    WHERE recurring_rule_id = ? AND generated_from_rule = 1
  `);

  const insertExpenseStmt = db.prepare(`
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
  `);

  const insertReminderStmt = db.prepare(`
    INSERT INTO reminders (
      id,
      expense_id,
      scheduled_date,
      days_before,
      sent,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const markOverdueStmt = db.prepare(`
    UPDATE expenses
    SET status = 'OVERDUE', updated_at = ?
    WHERE status = 'PENDING' AND due_date < ? AND is_active = 1
  `);

  const selectRemindersDueStmt = db.prepare(`
    SELECT
      r.id AS reminder_id,
      r.expense_id,
      e.description,
      e.amount,
      e.currency,
      e.due_date,
      r.days_before
    FROM reminders r
    JOIN expenses e ON e.id = r.expense_id
    WHERE r.scheduled_date <= ? AND r.sent = 0
    ORDER BY e.due_date ASC, r.scheduled_date ASC, r.id ASC
  `);

  const mutationResult = db.transaction((referenceDate: string) => {
    const recurringRules = selectRulesStmt.all() as RecurringExpenseRuleRow[];
    let expensesGenerated = 0;
    const now = new Date().toISOString();

    for (const rule of recurringRules) {
      const lastExpense = selectLastDateStmt.get(rule.id) as LastDateRow | undefined;
      let dueDate = nextDueDate(rule, lastExpense?.last_date ?? null);

      while (dueDate <= referenceDate) {
        if (rule.ends_on !== null && dueDate > rule.ends_on) {
          break;
        }

        const expenseId = randomUUID();
        insertExpenseStmt.run(
          expenseId,
          rule.amount,
          rule.currency,
          rule.category,
          null,
          rule.name,
          dueDate,
          null,
          "PENDING",
          "MANUAL",
          null,
          rule.id,
          1,
          1,
          now,
          now,
        );
        expensesGenerated += 1;

        if (rule.reminder_days_before > 0) {
          insertReminderStmt.run(
            randomUUID(),
            expenseId,
            subtractDaysFromIso(dueDate, rule.reminder_days_before),
            rule.reminder_days_before,
            0,
            now,
          );
        }

        dueDate = computeNextDate(
          dueDate,
          rule.frequency,
          rule.interval_days ?? 0,
        );
      }
    }

    const overdueResult = markOverdueStmt.run(now, referenceDate);

    return {
      expensesGenerated,
      expensesMarkedOverdue: overdueResult.changes,
    };
  })(today);

  const remindersDue = selectRemindersDueStmt.all(today) as DailySyncReminder[];

  return {
    expensesGenerated: mutationResult.expensesGenerated,
    expensesMarkedOverdue: mutationResult.expensesMarkedOverdue,
    remindersDue,
  };
}
