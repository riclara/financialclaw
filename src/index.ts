import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import { configureDb } from "./db/database.js";
import { InputSchema as ManageCurrencyInputSchema, executeManageCurrency } from "./tools/manage-currency.js";
import { InputSchema as LogExpenseFromReceiptInputSchema, executeLogExpenseFromReceipt } from "./tools/log-expense-from-receipt.js";
import { InputSchema as LogExpenseManualInputSchema, executeLogExpenseManual } from "./tools/log-expense-manual.js";
import { InputSchema as LogIncomeInputSchema, executeLogIncome } from "./tools/log-income.js";
import { InputSchema as LogIncomeReceiptInputSchema, executeLogIncomeReceipt } from "./tools/log-income-receipt.js";
import { InputSchema as AddRecurringExpenseInputSchema, executeAddRecurringExpense } from "./tools/add-recurring-expense.js";
import { InputSchema as MarkExpensePaidInputSchema, executeMarkExpensePaid } from "./tools/mark-expense-paid.js";
import { InputSchema as GetFinancialSummaryInputSchema, executeGetFinancialSummary } from "./tools/get-financial-summary.js";
import { InputSchema as ListExpensesInputSchema, executeListExpenses } from "./tools/list-expenses.js";
import { InputSchema as ListIncomesInputSchema, executeListIncomes } from "./tools/list-incomes.js";

function wrapExecute<T>(
  fn: (input: T) => Promise<string> | string,
) {
  return async (_id: string, params: T) => {
    const text = await fn(params);
    return {
      content: [{ type: "text" as const, text }],
      details: undefined,
    };
  };
}

export default definePluginEntry({
  id: "financialclaw",
  name: "FinancialClaw",
  description: "Plugin de finanzas personales: gastos, ingresos, recurrentes y OCR de recibos",

  register(api) {
    const config = api.pluginConfig ?? {};

    if (config.dbPath) {
      configureDb(config.dbPath as string);
    }

    // Configuración de Python CMD eliminada - OCR ahora es agéntico

    api.registerTool({
      name: "manage_currency",
      label: "Manage Currency",
      description: "Gestionar las monedas configuradas (agregar, listar, establecer default)",
      parameters: ManageCurrencyInputSchema,
      execute: wrapExecute(executeManageCurrency),
    });

    // log_expense_from_image eliminado - reemplazado por log_expense_from_receipt (OCR agéntico)

    api.registerTool({
      name: "log_expense_from_receipt",
      label: "Log Expense From Receipt",
      description: "Registrar gasto a partir de datos estructurados de OCR provistos por el agente",
      parameters: LogExpenseFromReceiptInputSchema,
      execute: wrapExecute(executeLogExpenseFromReceipt),
    });

    api.registerTool({
      name: "log_expense_manual",
      label: "Log Expense Manual",
      description: "Registrar gasto manualmente",
      parameters: LogExpenseManualInputSchema,
      execute: wrapExecute(executeLogExpenseManual),
    });

    api.registerTool({
      name: "log_income",
      label: "Log Income",
      description: "Registrar un ingreso",
      parameters: LogIncomeInputSchema,
      execute: wrapExecute(executeLogIncome),
    });

    api.registerTool({
      name: "log_income_receipt",
      label: "Log Income Receipt",
      description: "Registrar un pago recibido vinculado a un ingreso",
      parameters: LogIncomeReceiptInputSchema,
      execute: wrapExecute(executeLogIncomeReceipt),
    });

    api.registerTool({
      name: "add_recurring_expense",
      label: "Add Recurring Expense",
      description: "Crear regla de gasto recurrente",
      parameters: AddRecurringExpenseInputSchema,
      execute: wrapExecute(executeAddRecurringExpense),
    });

    api.registerTool({
      name: "mark_expense_paid",
      label: "Mark Expense Paid",
      description: "Marcar un gasto existente como pagado",
      parameters: MarkExpensePaidInputSchema,
      execute: wrapExecute(executeMarkExpensePaid),
    });

    api.registerTool({
      name: "get_financial_summary",
      label: "Get Financial Summary",
      description: "Obtener resumen financiero del período",
      parameters: GetFinancialSummaryInputSchema,
      execute: wrapExecute(executeGetFinancialSummary),
    });

    api.registerTool({
      name: "list_expenses",
      label: "List Expenses",
      description: "Listar gastos con filtros por período, estado, categoría o búsqueda",
      parameters: ListExpensesInputSchema,
      execute: wrapExecute(executeListExpenses),
    });

    api.registerTool({
      name: "list_incomes",
      label: "List Incomes",
      description: "Listar ingresos con filtros",
      parameters: ListIncomesInputSchema,
      execute: wrapExecute(executeListIncomes),
    });

    // No register services - reminders automation lives outside the plugin.
  },
});