import * as childProcess from "node:child_process";

import Database from "better-sqlite3";

import { getDb } from "../db/database.js";
import {
  dailySync,
  type DailySyncReminder,
  type DailySyncResult,
} from "./daily-sync.js";
import {
  formatAmount,
  resolveCurrency,
} from "../tools/helpers/currency-utils.js";

export interface ReminderRunnerInput {
  target: string;
  channel?: "telegram";
  accountId?: string;
  today?: string;
}

export interface ReminderRunnerResult {
  expensesGenerated: number;
  expensesMarkedOverdue: number;
  remindersDue: number;
  remindersSent: number;
  remindersFailed: number;
  failureMessages: string[];
}

export interface ReminderMessageInput {
  target: string;
  channel: "telegram";
  accountId?: string;
  message: string;
}

export interface ReminderRunnerDeps {
  db?: Database.Database;
  sync?: (
    db: Database.Database,
    today?: string,
  ) => DailySyncResult | Promise<DailySyncResult>;
  sendMessage?: (input: ReminderMessageInput) => void | Promise<void>;
  now?: () => Date;
}

let openClawCmd = "openclaw";

export function configureOpenClawCmd(cmd: string): void {
  const trimmed = cmd.trim();

  if (trimmed === "") {
    throw new Error("El comando de OpenClaw no puede estar vacío.");
  }

  openClawCmd = trimmed;
}

function getOpenClawCmd(): string {
  return openClawCmd;
}

function buildReminderMessage(
  reminder: DailySyncReminder,
  db: Database.Database,
): string {
  const currency = resolveCurrency(reminder.currency, db);
  const formattedAmount = formatAmount(reminder.amount, currency, db);
  const anticipationLine = reminder.days_before > 0
    ? `Este recordatorio se envía con ${reminder.days_before} día(s) de anticipación.`
    : null;

  return [
    "Recordatorio de pago",
    `Descripción: ${reminder.description}`,
    `Monto: ${formattedAmount}`,
    `Fecha de vencimiento: ${reminder.due_date}`,
    anticipationLine,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

async function sendReminderWithOpenClaw(
  input: ReminderMessageInput,
): Promise<void> {
  const args = [
    "message",
    "send",
    "--channel",
    input.channel,
    "--target",
    input.target,
  ];

  if (input.accountId !== undefined && input.accountId.trim() !== "") {
    args.push("--account", input.accountId);
  }

  args.push("--message", input.message);

  const result = childProcess.spawnSync(getOpenClawCmd(), args, {
    encoding: "utf8",
  });

  if (result.error !== undefined) {
    const error = result.error;

    if ("code" in error && error.code === "ENOENT") {
      throw new Error(
        `No se pudo ejecutar "${getOpenClawCmd()}". Verifica que OpenClaw CLI esté instalado y disponible en PATH.`,
      );
    }

    throw new Error(
      `Falló el envío del reminder con OpenClaw: ${error.message}`,
    );
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const detail = stderr === ""
      ? "OpenClaw devolvió un código de salida distinto de cero."
      : stderr;

    throw new Error(`Falló el envío del reminder con OpenClaw: ${detail}`);
  }
}

function validateInput(input: ReminderRunnerInput): Required<Pick<ReminderRunnerInput, "target" | "channel">> & ReminderRunnerInput {
  const target = input.target.trim();

  if (target === "") {
    throw new Error(
      "Falta el destino del reminder. Usa --target o FINANCIALCLAW_REMINDER_TARGET.",
    );
  }

  const channel = input.channel ?? "telegram";

  if (channel !== "telegram") {
    throw new Error(`El canal "${channel}" no está soportado. Usa "telegram".`);
  }

  return {
    ...input,
    target,
    channel,
  };
}

function sortReminders(reminders: DailySyncReminder[]): DailySyncReminder[] {
  return [...reminders].sort((left, right) => {
    if (left.due_date !== right.due_date) {
      return left.due_date.localeCompare(right.due_date);
    }

    return left.reminder_id.localeCompare(right.reminder_id);
  });
}

export async function runDailyReminderRunner(
  input: ReminderRunnerInput,
  deps: ReminderRunnerDeps = {},
): Promise<ReminderRunnerResult> {
  const validatedInput = validateInput(input);
  const db = deps.db ?? getDb();
  const sync = deps.sync ?? dailySync;
  const sendMessage = deps.sendMessage ?? sendReminderWithOpenClaw;
  const now = deps.now ?? (() => new Date());

  const syncResult = await sync(db, validatedInput.today);
  const reminders = sortReminders(syncResult.remindersDue);
  const markReminderSentStmt = db.prepare(`
    UPDATE reminders
    SET sent = 1, sent_at = ?
    WHERE id = ?
  `);

  let remindersSent = 0;
  let remindersFailed = 0;
  const failureMessages: string[] = [];

  for (const reminder of reminders) {
    try {
      const message = buildReminderMessage(reminder, db);

      await sendMessage({
        target: validatedInput.target,
        channel: validatedInput.channel,
        accountId: validatedInput.accountId,
        message,
      });

      markReminderSentStmt.run(now().toISOString(), reminder.reminder_id);
      remindersSent += 1;
    } catch (error) {
      remindersFailed += 1;
      failureMessages.push(
        error instanceof Error
          ? `Reminder ${reminder.reminder_id}: ${error.message}`
          : `Reminder ${reminder.reminder_id}: ${String(error)}`,
      );
    }
  }

  return {
    expensesGenerated: syncResult.expensesGenerated,
    expensesMarkedOverdue: syncResult.expensesMarkedOverdue,
    remindersDue: reminders.length,
    remindersSent,
    remindersFailed,
    failureMessages,
  };
}
