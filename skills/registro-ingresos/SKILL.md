---
name: registro-ingresos
description: |
  Log income in financialclaw. Use when: the user mentions receiving money, getting a salary, receiving a client payment, or wants to register a new income source. Also when they log a payment or partial installment received against an already existing income. NOT for: expenses, querying past income.
metadata:
  {
    "openclaw": { "emoji": "💰" }
  }
---

# Income logging

## New income

Use `log_income` for new income sources or one-time payments.

Required params: `amount`, `description`, `date`.
Optional params: `currency`, `is_recurring`, `frequency`, `interval_days`.

If the income is recurring (monthly salary, fixed client), set `is_recurring: true` and specify `frequency`.

Frequencies: `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `INTERVAL_DAYS`.
For `INTERVAL_DAYS`, `interval_days` is required.

Examples:
- "I got my salary of $3,000" → `log_income` with is_recurring: true, frequency: MONTHLY
- "A client paid me $500 USD" → `log_income` with currency: USD
- "Freelance income, $200 every two weeks" → frequency: BIWEEKLY

## Payment received on existing income

Use `log_income_receipt` when the user reports receiving an installment or payment against an already registered income (not a new one).

Requires `income_id`. If the user doesn't have it, use `list_incomes` first to show them.

Required params: `income_id`, `amount`, `date`.
Optional param: `notes`.

Example: "I received the March payment from client X" → find the income_id with `list_incomes`, then use `log_income_receipt`.
