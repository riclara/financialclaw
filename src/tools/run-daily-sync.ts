import { Type } from "@sinclair/typebox";
import type { Static } from "@sinclair/typebox";
import { DatabaseSync } from "node:sqlite";

import { getDb } from "../db/database.js";
import { dailySync } from "../services/daily-sync.js";
import { formatAmount, resolveCurrency } from "./helpers/currency-utils.js";
import { PACKAGE_NAME, PACKAGE_VERSION } from "../version.js";

export const InputSchema = Type.Object({});

export type Input = Static<typeof InputSchema>;

interface NpmLatestResponse {
  version: string;
}

const UPDATE_CHECK_TIMEOUT_MS = 3_000;

async function fetchLatestVersion(packageName: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => { controller.abort(); },
    UPDATE_CHECK_TIMEOUT_MS,
  );

  try {
    const encoded = encodeURIComponent(packageName).replace(/^%40/, "@");
    const response = await fetch(
      `https://registry.npmjs.org/${encoded}/latest`,
      { signal: controller.signal },
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json() as NpmLatestResponse;
    return data.version ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function isNewerVersion(current: string, candidate: string): boolean {
  const parse = (v: string): [number, number, number] => {
    const [major = 0, minor = 0, patch = 0] = v.split(".").map(Number);
    return [major, minor, patch];
  };

  const [cMaj, cMin, cPat] = parse(current);
  const [lMaj, lMin, lPat] = parse(candidate);

  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPat > cPat;
}

function markRemindersSent(
  db: DatabaseSync,
  reminderIds: string[],
): void {
  if (reminderIds.length === 0) {
    return;
  }

  const stmt = db.prepare(
    `UPDATE reminders SET sent = 1, sent_at = ? WHERE id = ?`,
  );

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
  db: DatabaseSync,
): string {
  const resolvedCurrency = resolveCurrency(currency, db);
  const formattedAmount = formatAmount(amount, resolvedCurrency, db);

  const timing =
    daysBefore > 0
      ? `vence en ${daysBefore} día${daysBefore > 1 ? "s" : ""} (${dueDate})`
      : `vence hoy (${dueDate})`;

  return `• ${description}: ${formattedAmount} — ${timing}`;
}

export async function executeRunDailySync(
  _params: Input,
  db: DatabaseSync = getDb(),
): Promise<string> {
  const result = dailySync(db);

  markRemindersSent(
    db,
    result.remindersDue.map((r) => r.reminder_id),
  );

  const lines: string[] = [];

  lines.push(`Sync diario completado:`);
  lines.push(`• Gastos recurrentes generados: ${result.expensesGenerated}`);
  lines.push(`• Gastos marcados como vencidos: ${result.expensesMarkedOverdue}`);

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

  try {
    const latestVersion = await fetchLatestVersion(PACKAGE_NAME);

    if (latestVersion !== null && isNewerVersion(PACKAGE_VERSION, latestVersion)) {
      lines.push(
        `\n⚠️ Actualización disponible: v${PACKAGE_VERSION} → v${latestVersion}`,
      );
      lines.push(
        `   Para actualizar: openclaw plugins update financialclaw && openclaw gateway restart`,
      );
    }
  } catch {
    // La verificación de actualizaciones es no-crítica — nunca debe romper el sync
  }

  return lines.join("\n");
}
