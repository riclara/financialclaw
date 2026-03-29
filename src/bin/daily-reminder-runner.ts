import { pathToFileURL } from "node:url";

import { configureDb } from "../db/database.js";
import {
  configureOpenClawCmd,
  runDailyReminderRunner,
  type ReminderRunnerInput,
  type ReminderRunnerResult,
} from "../services/daily-reminder-runner.js";

interface CliOptions {
  target?: string;
  channel?: "telegram";
  accountId?: string;
  dbPath?: string;
  openclawCmd?: string;
  today?: string;
}

interface CliDeps {
  configureDb?: (dbPath: string) => void;
  configureOpenClawCmd?: (cmd: string) => void;
  runDailyReminderRunner?: (
    input: ReminderRunnerInput,
  ) => Promise<ReminderRunnerResult>;
  stdout?: Pick<typeof console, "log">;
  stderr?: Pick<typeof console, "error">;
}

function resolveOption(
  flagValue: string | undefined,
  envValue: string | undefined,
): string | undefined {
  if (flagValue !== undefined) {
    return flagValue;
  }

  if (envValue === undefined) {
    return undefined;
  }

  return envValue;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const value = argv[index + 1];

    if (!arg.startsWith("--")) {
      throw new Error(`Argumento no reconocido: ${arg}`);
    }

    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Falta valor para la opción ${arg}.`);
    }

    switch (arg) {
      case "--target":
        options.target = value;
        break;
      case "--channel":
        if (value !== "telegram") {
          throw new Error(`El canal "${value}" no está soportado. Usa "telegram".`);
        }
        options.channel = value;
        break;
      case "--account":
        options.accountId = value;
        break;
      case "--db-path":
        options.dbPath = value;
        break;
      case "--openclaw-cmd":
        options.openclawCmd = value;
        break;
      case "--today":
        options.today = value;
        break;
      default:
        throw new Error(`Opción no reconocida: ${arg}`);
    }

    index += 1;
  }

  return options;
}

function formatSummary(result: ReminderRunnerResult): string {
  return [
    "Resumen daily-reminder-runner:",
    `- Gastos generados: ${result.expensesGenerated}`,
    `- Gastos marcados como vencidos: ${result.expensesMarkedOverdue}`,
    `- Reminders pendientes evaluados: ${result.remindersDue}`,
    `- Reminders enviados: ${result.remindersSent}`,
    `- Reminders fallidos: ${result.remindersFailed}`,
  ].join("\n");
}

export async function runDailyReminderRunnerCli(
  argv = process.argv.slice(2),
  env: NodeJS.ProcessEnv = process.env,
  deps: CliDeps = {},
): Promise<number> {
  const parsed = parseArgs(argv);
  const resolvedTarget = resolveOption(
    parsed.target,
    env.FINANCIALCLAW_REMINDER_TARGET,
  );
  const resolvedChannel = resolveOption(
    parsed.channel,
    env.FINANCIALCLAW_REMINDER_CHANNEL,
  ) as "telegram" | undefined;
  const resolvedAccountId = resolveOption(
    parsed.accountId,
    env.FINANCIALCLAW_REMINDER_ACCOUNT_ID,
  );
  const resolvedDbPath = resolveOption(
    parsed.dbPath,
    env.FINANCIALCLAW_DB_PATH,
  );
  const resolvedOpenClawCmd = resolveOption(
    parsed.openclawCmd,
    env.FINANCIALCLAW_OPENCLAW_CMD,
  );
  const stdout = deps.stdout ?? console;
  const stderr = deps.stderr ?? console;
  const configureDbImpl = deps.configureDb ?? configureDb;
  const configureOpenClawCmdImpl = deps.configureOpenClawCmd ?? configureOpenClawCmd;
  const runImpl = deps.runDailyReminderRunner ?? runDailyReminderRunner;

  try {
    if (resolvedDbPath !== undefined) {
      configureDbImpl(resolvedDbPath);
    }

    if (resolvedOpenClawCmd !== undefined) {
      configureOpenClawCmdImpl(resolvedOpenClawCmd);
    }

    const result = await runImpl({
      target: resolvedTarget ?? "",
      channel: resolvedChannel ?? "telegram",
      accountId: resolvedAccountId,
      today: parsed.today,
    });

    for (const message of result.failureMessages) {
      stderr.error(message);
    }

    stdout.log(formatSummary(result));
    return result.remindersFailed > 0 ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    stderr.error(`Error ejecutando daily-reminder-runner: ${message}`);
    return 1;
  }
}

function isDirectExecution(metaUrl: string): boolean {
  const entrypoint = process.argv[1];

  if (entrypoint === undefined) {
    return false;
  }

  return pathToFileURL(entrypoint).href === metaUrl;
}

if (isDirectExecution(import.meta.url)) {
  process.exitCode = await runDailyReminderRunnerCli();
}
