import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { runDailyReminderRunnerCli } from "../../src/bin/daily-reminder-runner.js";
import {
  configureOpenClawCmd,
  runDailyReminderRunner,
  type ReminderRunnerInput,
} from "../../src/services/daily-reminder-runner.js";
import { createTestDb } from "../helpers/test-db.js";

function insertCop(db: ReturnType<typeof createTestDb>): void {
  db.prepare(
    `INSERT OR IGNORE INTO currencies (code, name, symbol, is_default) VALUES ('COP', 'Peso colombiano', '$', 0)`,
  ).run();
}

function setDefault(db: ReturnType<typeof createTestDb>, code: string): void {
  db.prepare(`UPDATE currencies SET is_default = 0`).run();
  db.prepare(`UPDATE currencies SET is_default = 1 WHERE code = ?`).run(code);
}

function seedReminder(
  db: ReturnType<typeof createTestDb>,
  input: {
    expenseId: string;
    reminderId: string;
    description: string;
    amount: number;
    dueDate: string;
    daysBefore: number;
    scheduledDate?: string;
  },
): void {
  const timestamp = "2026-03-29T00:00:00.000Z";

  db.prepare(
    `INSERT INTO expenses (
      id, amount, currency, category, merchant, description, due_date,
      payment_date, status, source, ocr_extraction_id, recurring_rule_id,
      generated_from_rule, is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.expenseId,
    input.amount,
    "COP",
    "SERVICES",
    null,
    input.description,
    input.dueDate,
    null,
    "PENDING",
    "MANUAL",
    null,
    null,
    0,
    1,
    timestamp,
    timestamp,
  );

  db.prepare(
    `INSERT INTO reminders (
      id, expense_id, scheduled_date, days_before, sent, sent_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    input.reminderId,
    input.expenseId,
    input.scheduledDate ?? input.dueDate,
    input.daysBefore,
    0,
    null,
    timestamp,
  );
}

describe("daily-reminder-runner — integración", () => {
  it("envía reminders y marca sent con sent_at solo después del éxito", async () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");
    seedReminder(db, {
      expenseId: "expense-b",
      reminderId: "reminder-b",
      description: "Internet hogar",
      amount: 89_900,
      dueDate: "2026-03-31",
      daysBefore: 2,
    });
    seedReminder(db, {
      expenseId: "expense-a",
      reminderId: "reminder-a",
      description: "Arriendo",
      amount: 1_500_000,
      dueDate: "2026-03-30",
      daysBefore: 5,
    });

    const sentMessages: string[] = [];
    const result = await runDailyReminderRunner(
      {
        target: "@finanzas",
      },
      {
        db,
        sync: () => ({
          expensesGenerated: 2,
          expensesMarkedOverdue: 1,
          remindersDue: [
            {
              expense_id: "expense-b",
              reminder_id: "reminder-b",
              description: "Internet hogar",
              amount: 89_900,
              currency: "COP",
              due_date: "2026-03-31",
              days_before: 2,
            },
            {
              expense_id: "expense-a",
              reminder_id: "reminder-a",
              description: "Arriendo",
              amount: 1_500_000,
              currency: "COP",
              due_date: "2026-03-30",
              days_before: 5,
            },
          ],
        }),
        sendMessage: ({ message }) => {
          sentMessages.push(message);
        },
        now: () => new Date("2026-03-29T12:00:00.000Z"),
      },
    );

    const reminders = db
      .prepare(`SELECT id, sent, sent_at FROM reminders ORDER BY id ASC`)
      .all() as Array<{ id: string; sent: number; sent_at: string | null }>;

    assert.deepEqual(result, {
      expensesGenerated: 2,
      expensesMarkedOverdue: 1,
      remindersDue: 2,
      remindersSent: 2,
      remindersFailed: 0,
      failureMessages: [],
    });
    assert.deepEqual(
      reminders,
      [
        {
          id: "reminder-a",
          sent: 1,
          sent_at: "2026-03-29T12:00:00.000Z",
        },
        {
          id: "reminder-b",
          sent: 1,
          sent_at: "2026-03-29T12:00:00.000Z",
        },
      ],
    );
    assert.equal(sentMessages.length, 2);
    assert.match(sentMessages[0], /Descripción: Arriendo/);
    assert.match(sentMessages[0], /Monto: \$1\.500\.000 COP/);
    assert.match(sentMessages[0], /Fecha de vencimiento: 2026-03-30/);
    assert.match(sentMessages[0], /5 día\(s\) de anticipación/);
  });

  it("continúa ante un fallo parcial y no marca el reminder fallido", async () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");
    seedReminder(db, {
      expenseId: "expense-2",
      reminderId: "reminder-2",
      description: "Colegio",
      amount: 450_000,
      dueDate: "2026-03-30",
      daysBefore: 1,
    });
    seedReminder(db, {
      expenseId: "expense-1",
      reminderId: "reminder-1",
      description: "Internet",
      amount: 95_000,
      dueDate: "2026-03-30",
      daysBefore: 3,
    });

    const sentOrder: string[] = [];
    const result = await runDailyReminderRunner(
      {
        target: "@finanzas",
      },
      {
        db,
        sync: () => ({
          expensesGenerated: 0,
          expensesMarkedOverdue: 0,
          remindersDue: [
            {
              expense_id: "expense-2",
              reminder_id: "reminder-2",
              description: "Colegio",
              amount: 450_000,
              currency: "COP",
              due_date: "2026-03-30",
              days_before: 1,
            },
            {
              expense_id: "expense-1",
              reminder_id: "reminder-1",
              description: "Internet",
              amount: 95_000,
              currency: "COP",
              due_date: "2026-03-30",
              days_before: 3,
            },
          ],
        }),
        sendMessage: ({ message }) => {
          sentOrder.push(message);

          if (message.includes("Internet")) {
            throw new Error("fallo simulado");
          }
        },
        now: () => new Date("2026-03-29T14:00:00.000Z"),
      },
    );

    const reminders = db
      .prepare(`SELECT id, sent, sent_at FROM reminders ORDER BY id ASC`)
      .all() as Array<{ id: string; sent: number; sent_at: string | null }>;

    assert.deepEqual(sentOrder.map((message) => message.match(/Descripción: (.+)/)?.[1]), [
      "Internet",
      "Colegio",
    ]);
    assert.deepEqual(result, {
      expensesGenerated: 0,
      expensesMarkedOverdue: 0,
      remindersDue: 2,
      remindersSent: 1,
      remindersFailed: 1,
      failureMessages: [
        "Reminder reminder-1: fallo simulado",
      ],
    });
    assert.deepEqual(
      reminders,
      [
        {
          id: "reminder-1",
          sent: 0,
          sent_at: null,
        },
        {
          id: "reminder-2",
          sent: 1,
          sent_at: "2026-03-29T14:00:00.000Z",
        },
      ],
    );
  });

  it("configureOpenClawCmd cambia el comando usado por el sender por defecto", async () => {
    const db = createTestDb();
    insertCop(db);
    setDefault(db, "COP");
    seedReminder(db, {
      expenseId: "expense-openclaw",
      reminderId: "reminder-openclaw",
      description: "Hosting",
      amount: 120_000,
      dueDate: "2026-03-30",
      daysBefore: 2,
    });

    const tempDir = mkdtempSync(join(tmpdir(), "financialclaw-reminder-runner-"));
    const argsFile = join(tempDir, "args.json");
    const commandFile = join(tempDir, "fake-openclaw");

    writeFileSync(
      commandFile,
      `#!/usr/bin/env node
const fs = require("node:fs");
fs.writeFileSync(${JSON.stringify(argsFile)}, JSON.stringify(process.argv.slice(2)));
`,
    );
    chmodSync(commandFile, 0o755);
    configureOpenClawCmd(commandFile);

    try {
      const result = await runDailyReminderRunner(
        {
          target: "@finanzas",
          accountId: "cuenta-telegram",
        },
        {
          db,
          sync: () => ({
            expensesGenerated: 0,
            expensesMarkedOverdue: 0,
            remindersDue: [
              {
                expense_id: "expense-openclaw",
                reminder_id: "reminder-openclaw",
                description: "Hosting",
                amount: 120_000,
                currency: "COP",
                due_date: "2026-03-30",
                days_before: 2,
              },
            ],
          }),
          now: () => new Date("2026-03-29T15:00:00.000Z"),
        },
      );

      assert.equal(result.remindersSent, 1);
      assert.deepEqual(JSON.parse(readFileSync(argsFile, "utf8")), [
        "message",
        "send",
        "--channel",
        "telegram",
        "--target",
        "@finanzas",
        "--account",
        "cuenta-telegram",
        "--message",
        "Recordatorio de pago\nDescripción: Hosting\nMonto: $120.000 COP\nFecha de vencimiento: 2026-03-30\nEste recordatorio se envía con 2 día(s) de anticipación.",
      ]);
    } finally {
      configureOpenClawCmd("openclaw");
    }
  });

  it("retorna error descriptivo si falta target", async () => {
    const db = createTestDb();

    await assert.rejects(
      runDailyReminderRunner(
        {
          target: "   ",
        },
        {
          db,
          sync: () => ({
            expensesGenerated: 0,
            expensesMarkedOverdue: 0,
            remindersDue: [],
          }),
        },
      ),
      /Falta el destino del reminder/,
    );
  });

  it("sin reminders pendientes retorna éxito sin invocar sender", async () => {
    const db = createTestDb();
    let sendCalls = 0;

    const result = await runDailyReminderRunner(
      {
        target: "@finanzas",
      },
      {
        db,
        sync: () => ({
          expensesGenerated: 1,
          expensesMarkedOverdue: 0,
          remindersDue: [],
        }),
        sendMessage: () => {
          sendCalls += 1;
        },
      },
    );

    assert.deepEqual(result, {
      expensesGenerated: 1,
      expensesMarkedOverdue: 0,
      remindersDue: 0,
      remindersSent: 0,
      remindersFailed: 0,
      failureMessages: [],
    });
    assert.equal(sendCalls, 0);
  });

  it("el wrapper CLI resuelve target, dbPath y openclawCmd desde flags y env antes de ejecutar", async () => {
    const configureDbCalls: string[] = [];
    const configureOpenClawCalls: string[] = [];
    const stdoutLines: string[] = [];
    const stderrLines: string[] = [];
    const runnerCalls: ReminderRunnerInput[] = [];

    const exitCode = await runDailyReminderRunnerCli(
      [
        "--target",
        "@desde-flag",
        "--account",
        "cuenta-flag",
        "--db-path",
        "/tmp/flag.sqlite",
        "--openclaw-cmd",
        "openclaw-flag",
        "--today",
        "2026-03-29",
      ],
      {
        FINANCIALCLAW_REMINDER_TARGET: "@desde-env",
        FINANCIALCLAW_REMINDER_ACCOUNT_ID: "cuenta-env",
        FINANCIALCLAW_DB_PATH: "/tmp/env.sqlite",
        FINANCIALCLAW_OPENCLAW_CMD: "openclaw-env",
      },
      {
        configureDb: (dbPath) => {
          configureDbCalls.push(dbPath);
        },
        configureOpenClawCmd: (cmd) => {
          configureOpenClawCalls.push(cmd);
        },
        runDailyReminderRunner: async (input) => {
          runnerCalls.push(input);

          return {
            expensesGenerated: 0,
            expensesMarkedOverdue: 0,
            remindersDue: 0,
            remindersSent: 0,
            remindersFailed: 0,
            failureMessages: [],
          };
        },
        stdout: {
          log: (line) => {
            stdoutLines.push(line);
          },
        },
        stderr: {
          error: (line) => {
            stderrLines.push(line);
          },
        },
      },
    );

    assert.equal(exitCode, 0);
    assert.deepEqual(configureDbCalls, ["/tmp/flag.sqlite"]);
    assert.deepEqual(configureOpenClawCalls, ["openclaw-flag"]);
    assert.deepEqual(runnerCalls, [
      {
        target: "@desde-flag",
        channel: "telegram",
        accountId: "cuenta-flag",
        today: "2026-03-29",
      },
    ]);
    assert.equal(stderrLines.length, 0);
    assert.match(stdoutLines[0], /Resumen daily-reminder-runner/);
  });
});
