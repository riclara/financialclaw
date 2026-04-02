import { DatabaseSync } from "node:sqlite";
import { Type, type Static } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

import { getDb } from "../db/database.js";

const ISO_DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

export const InputSchema = Type.Object(
  {
    expense_id: Type.String({ minLength: 1 }),
    payment_date: Type.Optional(Type.String({ pattern: ISO_DATE_PATTERN })),
  },
  { additionalProperties: false },
);

export type MarkExpensePaidInput = Static<typeof InputSchema>;

type ExpenseRow = {
  id: string;
  status: string;
  payment_date: string | null;
  updated_at: string;
};

function assertValidInput(input: MarkExpensePaidInput): void {
  if (!Value.Check(InputSchema, input)) {
    throw new Error(
      "Invalid parameters: expense_id is required and payment_date must be in YYYY-MM-DD format.",
    );
  }

  if (input.expense_id.trim() === "") {
    throw new Error("The expense_id field is required.");
  }
}

export function executeMarkExpensePaid(
  input: MarkExpensePaidInput,
  db: DatabaseSync = getDb(),
): string {
  assertValidInput(input);

  const expenseId = input.expense_id;
  const expense = db
    .prepare(
      `
        SELECT id, status, payment_date, updated_at
        FROM expenses
        WHERE id = ?
      `,
    )
    .get(expenseId) as ExpenseRow | undefined;

  if (expense === undefined) {
    throw new Error(`No expense found with ID "${expenseId}".`);
  }

  if (expense.status === "PAID") {
    return `Expense "${expenseId}" was already marked as paid.`;
  }

  const paymentDate = input.payment_date ?? new Date().toISOString().slice(0, 10);
  const updatedAt = new Date().toISOString();

  db.prepare(
    `
      UPDATE expenses
      SET status = 'PAID',
          payment_date = ?,
          updated_at = ?
      WHERE id = ?
        AND status != 'PAID'
    `,
  ).run(paymentDate, updatedAt, expenseId);

  return `Expense "${expenseId}" marked as paid on ${paymentDate}.`;
}
