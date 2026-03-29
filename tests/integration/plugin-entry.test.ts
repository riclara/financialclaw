import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import ts from "typescript";

const EXPECTED_TOOL_NAMES = [
  "manage_currency",
  "log_expense_from_image",
  "log_expense_manual",
  "log_income",
  "log_income_receipt",
  "add_recurring_expense",
  "mark_expense_paid",
  "get_financial_summary",
  "list_expenses",
  "list_incomes",
] as const;

type ToolName = (typeof EXPECTED_TOOL_NAMES)[number];

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  details: undefined;
};

interface RegisteredTool {
  name: string;
  description: string;
  parameters: unknown;
  execute: (id: string, params: Record<string, unknown>) => Promise<ToolResult>;
}

interface LoadedPlugin {
  plugin: {
    register(api: {
      pluginConfig?: Record<string, unknown>;
      registerTool(tool: RegisteredTool): void;
      registerService(service: unknown): void;
    }): void;
  };
  configureDbCalls: string[];
  configurePythonCmdCalls: string[];
  toolExecuteCalls: Array<{ tool: ToolName; params: Record<string, unknown> }>;
}

const INDEX_FILE_URL = new URL("../../src/index.ts", import.meta.url);

function compileIndexToCommonJs(sourceText: string): string {
  return ts.transpileModule(sourceText, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
    fileName: INDEX_FILE_URL.pathname,
  }).outputText;
}

async function loadPlugin(): Promise<LoadedPlugin> {
  const sourceText = await readFile(INDEX_FILE_URL, "utf8");
  const compiledSource = compileIndexToCommonJs(sourceText);

  const configureDbCalls: string[] = [];
  const configurePythonCmdCalls: string[] = [];
  const toolExecuteCalls: Array<{ tool: ToolName; params: Record<string, unknown> }> = [];

  const toolModuleMap: Record<string, { tool: ToolName; executeExport: string }> = {
    "./tools/manage-currency.js": {
      tool: "manage_currency",
      executeExport: "executeManageCurrency",
    },
    "./tools/log-expense-from-image.js": {
      tool: "log_expense_from_image",
      executeExport: "executeLogExpenseFromImage",
    },
    "./tools/log-expense-manual.js": {
      tool: "log_expense_manual",
      executeExport: "executeLogExpenseManual",
    },
    "./tools/log-income.js": {
      tool: "log_income",
      executeExport: "executeLogIncome",
    },
    "./tools/log-income-receipt.js": {
      tool: "log_income_receipt",
      executeExport: "executeLogIncomeReceipt",
    },
    "./tools/add-recurring-expense.js": {
      tool: "add_recurring_expense",
      executeExport: "executeAddRecurringExpense",
    },
    "./tools/mark-expense-paid.js": {
      tool: "mark_expense_paid",
      executeExport: "executeMarkExpensePaid",
    },
    "./tools/get-financial-summary.js": {
      tool: "get_financial_summary",
      executeExport: "executeGetFinancialSummary",
    },
    "./tools/list-expenses.js": {
      tool: "list_expenses",
      executeExport: "executeListExpenses",
    },
    "./tools/list-incomes.js": {
      tool: "list_incomes",
      executeExport: "executeListIncomes",
    },
  };

  const stubModules = new Map<string, Record<string, unknown>>([
    [
      "openclaw/plugin-sdk/plugin-entry",
      {
        definePluginEntry: <T>(entry: T) => entry,
      },
    ],
    [
      "./db/database.js",
      {
        configureDb: (dbPath: string) => {
          configureDbCalls.push(dbPath);
        },
      },
    ],
    [
      "./ocr/paddle-ocr-subprocess.js",
      {
        configurePythonCmd: (pythonCmd: string) => {
          configurePythonCmdCalls.push(pythonCmd);
        },
      },
    ],
  ]);

  for (const [specifier, { tool, executeExport }] of Object.entries(toolModuleMap)) {
    stubModules.set(specifier, {
      InputSchema: { type: "object", tool },
      [executeExport]: (params: Record<string, unknown>) => {
        toolExecuteCalls.push({ tool, params });
        return `stub:${tool}:${JSON.stringify(params)}`;
      },
    });
  }

  const module = { exports: {} as Record<string, unknown> };
  const evaluator = new Function(
    "require",
    "module",
    "exports",
    compiledSource,
  );

  evaluator(
    (specifier: string) => {
      const stubModule = stubModules.get(specifier);
      if (stubModule === undefined) {
        throw new Error(`Import inesperado durante el test del entry point: ${specifier}`);
      }
      return stubModule;
    },
    module,
    module.exports,
  );

  return {
    plugin: module.exports.default as LoadedPlugin["plugin"],
    configureDbCalls,
    configurePythonCmdCalls,
    toolExecuteCalls,
  };
}

describe("plugin entry wiring", () => {
  it("carga el plugin y registra exactamente los 10 tools esperados sin duplicados ni services", async () => {
    const { plugin } = await loadPlugin();
    const registerToolCalls: RegisteredTool[] = [];
    const registerServiceCalls: unknown[] = [];

    assert.equal(typeof plugin.register, "function");

    plugin.register({
      pluginConfig: {
        reminders: {
          enabled: true,
        },
      },
      registerTool(tool) {
        registerToolCalls.push(tool);
      },
      registerService(service) {
        registerServiceCalls.push(service);
      },
    });

    assert.equal(registerToolCalls.length, EXPECTED_TOOL_NAMES.length);
    assert.deepEqual(
      registerToolCalls.map((tool) => tool.name),
      [...EXPECTED_TOOL_NAMES],
    );
    assert.equal(
      new Set(registerToolCalls.map((tool) => tool.name)).size,
      EXPECTED_TOOL_NAMES.length,
    );
    assert.equal(registerServiceCalls.length, 0);
  });

  it("llama configureDb y configurePythonCmd cuando llegan en pluginConfig", async () => {
    const {
      plugin,
      configureDbCalls,
      configurePythonCmdCalls,
    } = await loadPlugin();

    plugin.register({
      pluginConfig: {
        dbPath: "/tmp/financialclaw.sqlite",
        pythonCmd: "/tmp/venv/bin/python3",
        reminders: {
          enabled: true,
        },
      },
      registerTool() {},
      registerService() {
        assert.fail("registerService no debe llamarse en TASK-20.");
      },
    });

    assert.deepEqual(configureDbCalls, ["/tmp/financialclaw.sqlite"]);
    assert.deepEqual(configurePythonCmdCalls, ["/tmp/venv/bin/python3"]);
  });

  it("adapta executeXxx a ToolResult para al menos un tool", async () => {
    const { plugin, toolExecuteCalls } = await loadPlugin();
    const registerToolCalls: RegisteredTool[] = [];

    plugin.register({
      pluginConfig: {},
      registerTool(tool) {
        registerToolCalls.push(tool);
      },
      registerService() {
        assert.fail("registerService no debe llamarse en TASK-20.");
      },
    });

    const manageCurrencyTool = registerToolCalls.find(
      (tool) => tool.name === "manage_currency",
    );

    assert.ok(manageCurrencyTool);

    const result = await manageCurrencyTool.execute("invocation-id", {
      action: "list",
    });

    assert.deepEqual(result, {
      content: [
        {
          type: "text",
          text: 'stub:manage_currency:{"action":"list"}',
        },
      ],
      details: undefined,
    });
    assert.deepEqual(toolExecuteCalls, [
      {
        tool: "manage_currency",
        params: { action: "list" },
      },
    ]);
  });
});
