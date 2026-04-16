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
import { InputSchema as RunDailySyncInputSchema, executeRunDailySync } from "./tools/run-daily-sync.js";
import { InputSchema as ManageFundInputSchema, executeManageFund } from "./tools/manage-fund.js";
import { InputSchema as PlanAllocationInputSchema, executePlanAllocation } from "./tools/plan-allocation.js";

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
  description: "Personal finance plugin: expenses, income, recurring payments, and receipt OCR",

  register(api) {
    const config = api.pluginConfig ?? {};

    if (config.dbPath) {
      configureDb(config.dbPath as string);
    }

    // Python CMD config removed - OCR is now agentic

    api.registerTool({
      name: "manage_currency",
      label: "Manage Currency",
      description: "Manage configured currencies (add, list, set default)",
      parameters: ManageCurrencyInputSchema,
      execute: wrapExecute(executeManageCurrency),
    });

    // log_expense_from_image removed - replaced by log_expense_from_receipt (agentic OCR)

    api.registerTool({
      name: "log_expense_from_receipt",
      label: "Log Expense From Receipt",
      description: "Log an expense from structured OCR data provided by the agent",
      parameters: LogExpenseFromReceiptInputSchema,
      execute: wrapExecute(executeLogExpenseFromReceipt),
    });

    api.registerTool({
      name: "log_expense_manual",
      label: "Log Expense Manual",
      description: "Log an expense manually",
      parameters: LogExpenseManualInputSchema,
      execute: wrapExecute(executeLogExpenseManual),
    });

    api.registerTool({
      name: "log_income",
      label: "Log Income",
      description: "Log an income entry",
      parameters: LogIncomeInputSchema,
      execute: wrapExecute(executeLogIncome),
    });

    api.registerTool({
      name: "log_income_receipt",
      label: "Log Income Receipt",
      description: "Log a received payment linked to an income entry",
      parameters: LogIncomeReceiptInputSchema,
      execute: wrapExecute(executeLogIncomeReceipt),
    });

    api.registerTool({
      name: "add_recurring_expense",
      label: "Add Recurring Expense",
      description: "Create a recurring expense rule",
      parameters: AddRecurringExpenseInputSchema,
      execute: wrapExecute(executeAddRecurringExpense),
    });

    api.registerTool({
      name: "mark_expense_paid",
      label: "Mark Expense Paid",
      description: "Mark an existing expense as paid",
      parameters: MarkExpensePaidInputSchema,
      execute: wrapExecute(executeMarkExpensePaid),
    });

    api.registerTool({
      name: "get_financial_summary",
      label: "Get Financial Summary",
      description: "Get a financial summary for a given period",
      parameters: GetFinancialSummaryInputSchema,
      execute: wrapExecute(executeGetFinancialSummary),
    });

    api.registerTool({
      name: "list_expenses",
      label: "List Expenses",
      description: "List expenses with filters by period, status, category, or search term",
      parameters: ListExpensesInputSchema,
      execute: wrapExecute(executeListExpenses),
    });

    api.registerTool({
      name: "list_incomes",
      label: "List Incomes",
      description: "List income entries with filters",
      parameters: ListIncomesInputSchema,
      execute: wrapExecute(executeListIncomes),
    });

    api.registerTool({
      name: "run_daily_sync",
      label: "Run Daily Sync",
      description:
        "Run the daily sync: generates pending recurring expense instances, marks overdue ones, and returns payment reminders for the day. Invoke from automatic cron or when the user wants to see pending items.",
      parameters: RunDailySyncInputSchema,
      execute: wrapExecute(executeRunDailySync),
    });

    api.registerTool({
      name: "manage_fund",
      label: "Manage Fund",
      description:
        "Create, list, fund, withdraw from, or archive financial containers such as savings funds and bank accounts.",
      parameters: ManageFundInputSchema,
      execute: wrapExecute(executeManageFund),
    });

    api.registerTool({
      name: "plan_allocation",
      label: "Plan Allocation",
      description:
        "Given an income amount, shows pending commitments for the current month (recurring + manual) and the remaining available balance. Use when the user receives a payment and wants to know how to allocate it. Operates per currency: if the user receives income in multiple currencies, call this tool once per currency. For example, if they receive COP salary and USD freelance income, call it twice with the corresponding amount and currency each time.",
      parameters: PlanAllocationInputSchema,
      execute: wrapExecute(executePlanAllocation),
    });
  },
});
