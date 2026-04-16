import { DatabaseSync } from "node:sqlite";
import { type Static, Type } from "@sinclair/typebox";
import { getDb } from "../db/database.js";
import { todayISO } from "./helpers/date-utils.js";
import {
  formatAmount,
  PLACEHOLDER_CURRENCY,
  resolveCurrency,
} from "./helpers/currency-utils.js";

export const InputSchema = Type.Object(
  {
    amount: Type.Number({
      minimum: 1,
      description: "Income amount to allocate (e.g. the salary or payment just received).",
    }),
    currency: Type.Optional(
      Type.String({
        description:
          "ISO 4217 currency code (e.g. 'COP', 'USD'). Defaults to the configured default currency.",
      }),
    ),
  },
  { additionalProperties: false },
);

export type PlanAllocationInput = Static<typeof InputSchema>;

interface ExpenseRow {
  description: string;
  amount: number;
  due_date: string;
  payment_date: string | null;
  recurring_rule_id: string | null;
}

interface RuleRow {
  id: string;
  name: string;
  amount: number;
  frequency: string;
  starts_on: string;
  day_of_month: number | null;
  interval_days: number | null;
}

interface OtherCurrencyRow {
  currency: string;
  count: number;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Returns the full calendar month [YYYY-MM-01, YYYY-MM-last] for a given ISO date. */
function currentMonthRange(today: string): { start: string; end: string } {
  const parts = today.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]); // 1-indexed (April = 4)
  const start = `${parts[0]}-${parts[1]}-01`;
  // new Date(Date.UTC(year, month, 0)): JS month `month` (0-indexed May) → day 0 = April 30 ✓
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const end = `${parts[0]}-${parts[1]}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

/**
 * Estimates the expected due date for a recurring rule that has no generated expense
 * in the current month. Returns null when the rule's cycle skips the current month
 * (possible for INTERVAL_DAYS with interval_days > 31) so the caller can exclude it.
 */
function estimateDueDate(
  rule: RuleRow,
  monthStart: string,
  monthEnd: string,
): string | null {
  const [syear, smonth, sday] = rule.starts_on.split("-").map(Number);
  const [year, month] = monthStart.split("-").map(Number);

  if (rule.frequency === "MONTHLY") {
    const anchorDay = rule.day_of_month ?? sday;
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${monthStart.slice(0, 7)}-${pad2(Math.min(anchorDay, lastDay))}`;
  }

  const stepDays =
    rule.frequency === "WEEKLY" ? 7
    : rule.frequency === "BIWEEKLY" ? 14
    : (rule.interval_days ?? 30);

  const startMs = Date.UTC(syear, smonth - 1, sday);
  const monthStartMs = Date.UTC(year, month - 1, 1);
  const [ey, em, ed] = monthEnd.split("-").map(Number);
  const monthEndMs = Date.UTC(ey, em - 1, ed);
  const stepMs = stepDays * 86_400_000;

  let candidateMs = startMs;
  if (candidateMs < monthStartMs) {
    const steps = Math.ceil((monthStartMs - candidateMs) / stepMs);
    candidateMs += steps * stepMs;
  }

  if (candidateMs > monthEndMs) {
    return null;
  }

  const d = new Date(candidateMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

export function executePlanAllocation(
  input: PlanAllocationInput,
  db: DatabaseSync = getDb(),
): string {
  const currency = resolveCurrency(input.currency, db);
  const today = todayISO();
  const { start: monthStart, end: monthEnd } = currentMonthRange(today);
  const fmt = (amount: number) => formatAmount(amount, currency);

  // ── Queries ────────────────────────────────────────────────────────────────

  // 1. PENDING/OVERDUE expenses this month in this currency
  const pendingExpenses = db
    .prepare(
      `SELECT description, amount, due_date, recurring_rule_id
       FROM expenses
       WHERE status IN ('PENDING', 'OVERDUE')
         AND due_date BETWEEN ? AND ?
         AND is_active = 1
         AND currency = ?
       ORDER BY due_date ASC`,
    )
    .all(monthStart, monthEnd, currency.code) as unknown as ExpenseRow[];

  // 2. Active recurring rules without a generated expense this month
  const unsyncedRules = db
    .prepare(
      `SELECT r.id, r.name, r.amount, r.frequency, r.starts_on, r.day_of_month, r.interval_days
       FROM recurring_expense_rules r
       WHERE r.is_active = 1
         AND r.currency = ?
         AND r.starts_on <= ?
         AND (r.ends_on IS NULL OR r.ends_on >= ?)
         AND NOT EXISTS (
           SELECT 1 FROM expenses e
           WHERE e.recurring_rule_id = r.id
             AND e.due_date BETWEEN ? AND ?
         )`,
    )
    .all(currency.code, monthEnd, monthStart, monthStart, monthEnd) as unknown as RuleRow[];

  // 3. Already paid this month (informative)
  const paidExpenses = db
    .prepare(
      `SELECT description, amount, payment_date, recurring_rule_id
       FROM expenses
       WHERE status = 'PAID'
         AND due_date BETWEEN ? AND ?
         AND is_active = 1
         AND currency = ?
       ORDER BY payment_date ASC`,
    )
    .all(monthStart, monthEnd, currency.code) as unknown as ExpenseRow[];

  // 4. Pending commitments in other currencies (informative note)
  const otherCurrencies = db
    .prepare(
      `SELECT currency, COUNT(*) as count
       FROM expenses
       WHERE status IN ('PENDING', 'OVERDUE')
         AND due_date BETWEEN ? AND ?
         AND is_active = 1
         AND currency != ?
       GROUP BY currency`,
    )
    .all(monthStart, monthEnd, currency.code) as unknown as OtherCurrencyRow[];

  // ── Calculations ───────────────────────────────────────────────────────────

  const unsyncedRulesWithDates = unsyncedRules
    .map((rule) => ({ rule, dueDate: estimateDueDate(rule, monthStart, monthEnd) }))
    .filter((entry): entry is { rule: RuleRow; dueDate: string } => entry.dueDate !== null);

  const totalFromExpenses = pendingExpenses.reduce((sum, e) => sum + e.amount, 0);
  const totalFromRules = unsyncedRulesWithDates.reduce((sum, e) => sum + e.rule.amount, 0);
  const totalPending = totalFromExpenses + totalFromRules;
  const totalPaid = paidExpenses.reduce((sum, e) => sum + e.amount, 0);
  const available = input.amount - totalPending;
  const pct = (totalPending / input.amount) * 100;

  // ── Output ─────────────────────────────────────────────────────────────────

  const lines: string[] = [];
  lines.push(`Received: ${fmt(input.amount)}`);
  lines.push("");

  if (pendingExpenses.length === 0 && unsyncedRulesWithDates.length === 0) {
    lines.push(`No pending commitments this month. ${fmt(input.amount)} fully available.`);
  } else {
    lines.push("Pending commitments this month:");
    for (const e of pendingExpenses) {
      const label = e.recurring_rule_id ? "(recurring)" : "(manual)";
      lines.push(`  ${e.description}  ${fmt(e.amount)}  due ${e.due_date}  ${label}`);
    }
    for (const { rule, dueDate } of unsyncedRulesWithDates) {
      lines.push(`  ${rule.name}  ${fmt(rule.amount)}  due ${dueDate}  (estimated)`);
    }
    lines.push("  ──────────────────────────────────────");
    lines.push(`  Total committed: ${fmt(totalPending)} (${pct.toFixed(1)}%)`);
    lines.push("");
  }

  if (paidExpenses.length > 0) {
    lines.push("Already paid this month:");
    for (const e of paidExpenses) {
      const label = e.recurring_rule_id ? "(recurring)" : "(manual)";
      lines.push(`  ${e.description}  ${fmt(e.amount)}  paid ${e.payment_date ?? "?"}  ${label}`);
    }
    lines.push("  ──────────────────────────────────────");
    lines.push(`  Total paid: ${fmt(totalPaid)}`);
    lines.push("");
  }

  if (available < 0) {
    lines.push(`⚠ Commitments (${fmt(totalPending)}) exceed income. Deficit: ${fmt(available)}`);
  } else if (totalPending > 0) {
    lines.push(`Available: ${fmt(available)}`);
  }

  if (otherCurrencies.length > 0) {
    lines.push("");
    const codes = otherCurrencies.map((r) => r.currency).join(", ");
    lines.push(
      `Note: You also have pending commitments in ${codes} not included above. Call plan_allocation again with the corresponding amount and currency to see the full picture for ${codes}.`,
    );
  }

  if (currency.code === PLACEHOLDER_CURRENCY) {
    lines.push("");
    lines.push(
      "Tip: Your default currency is not configured. Use manage_currency to set it up.",
    );
  }

  return lines.join("\n").trimEnd();
}
