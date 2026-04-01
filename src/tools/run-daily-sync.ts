import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import Database from "better-sqlite3";

import { getDb } from "../db/database.js";
import { dailySync } from "../services/daily-sync.js";
import { formatAmount, resolveCurrency } from "./helpers/currency-utils.js";

export const InputSchema = Type.Object({});

export type Input = Static<typeof InputSchema>;

interface MarkSentStmt {
  run(sentAt: string, reminderId: string): void;
}

function markRemindersSent(
  db: Database.Database,
  reminderIds: string[],
): void {
  if (reminderIds.length === 0) {
    return;
  }

  const stmt = db.prepare(
    `UPDATE reminders SET sent = 1, sent_at = ? WHERE id = ?`,
  ) as unknown as MarkSentStmt;

  const now = new Date().toISOString();

  for (const id of reminderIds) {
    stmt.run(now, id);
  }
}

function formatReminderLine(
  description: string,
  amount: number,
  currency: string,
  dueDate: string,
  daysBefore: number,
  db: Database.Database,
): string {
  const resolvedCurrency = resolveCurrency(currency, db);
  const formattedAmount = formatAmount(amount, resolvedCurrency, db);

  const timing =
    daysBefore > 0
      ? `vence en ${daysBefore} día${daysBefore > 1 ? "s" : ""} (${dueDate})`
      : `vence hoy (${dueDate})`;

  return `• ${description}: ${formattedAmount} — ${timing}`;
}

export function executeRunDailySync(
  _params: Input,
  db: Database.Database = getDb(),
): string {
  const result = dailySync(db);

  markRemindersSent(
    db,
    result.remindersDue.map((r) => r.reminder_id),
  );

  const lines: string[] = [];

  lines.push(`Sync diario completado:`);
  lines.push(
    `• Gastos recurrentes generados: ${result.expensesGenerated}`,
  );
  lines.push(
    `• Gastos marcados como vencidos: ${result.expensesMarkedOverdue}`,
  );

  if (result.remindersDue.length === 0) {
    lines.push(`• Sin recordatorios pendientes — finanzas al día ✓`);
  } else {
    lines.push(`\nRecordatorios pendientes (${result.remindersDue.length}):`);

    for (const reminder of result.remindersDue) {
      lines.push(
        formatReminderLine(
          reminder.description,
          reminder.amount,
          reminder.currency,
          reminder.due_date,
          reminder.days_before,
          db,
        ),
      );
    }
  }

  return lines.join("\n");
}
