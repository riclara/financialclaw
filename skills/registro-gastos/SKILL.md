---
name: registro-gastos
description: |
  Log expenses in financialclaw. Use when: the user mentions spending money, buying something, paying a bill, or sends a photo of a receipt or ticket. Also when they want to mark an existing expense as paid, or set up a recurring expense (utilities, subscriptions, fixed fees). NOT for: income, querying past expenses, currency configuration.
metadata:
  {
    "openclaw": { "emoji": "💸" }
  }
---

# Expense logging

## Manual expense

Use `log_expense_manual` when the user describes an expense in words (no photo).

Required params: `amount`, `description`.
Optional params: `category`, `currency`, `merchant`, `due_date`.

If the amount is missing, ask before logging. If the date is missing, today is used by default (the tool handles this automatically).

Available categories: `HOUSING`, `SERVICES`, `TRANSPORT`, `SUPERMARKET`, `HEALTH`, `EDUCATION`, `ENTERTAINMENT`, `RESTAURANT`, `OTHER`.

Examples:
- "I spent $50 at the supermarket" → `log_expense_manual` with category: SUPERMARKET
- "I paid rent" → ask for the amount if not given
- "Lunch for $18 at Crepes & Waffles" → include merchant

## Expense from receipt photo

Use `log_expense_from_receipt` when the user sends a photo of a receipt, ticket, or invoice.

Mandatory flow — do not skip any step:

1. Extract from the receipt using your vision capabilities:
   - `amount`: the receipt total (number, no currency symbols or thousand separators)
   - `date`: date in YYYY-MM-DD format
   - `merchant`: name of the establishment
   - `category`: infer from the type of business
   - `raw_text`: all visible text from the receipt

2. Before invoking the tool, show the extracted data to the user and ask for confirmation:

   Message:
   > "Here's what I found on the receipt — is this correct?
   > • Amount: [amount]
   > • Date: [date]
   > • Merchant: [merchant]
   > • Category: [category]"

   If the channel is Telegram: send the message with an inline button "Yes ✅" using an interactive block (`type: "buttons"`, `label: "Yes ✅"`, `value: "si"`). The user can press the button to confirm, or type directly what needs to be corrected.

   If the channel is not Telegram: ask for confirmation in plain text ("Reply 'yes' to save or tell me what to correct").

3. Only call `log_expense_from_receipt` after the user confirms (button or affirmative text) or after applying the corrections they indicate.

## Mark expense as paid

Use `mark_expense_paid` when the user confirms they paid a pending expense.

You need the `expense_id`. If the user doesn't have it handy, use `list_expenses` with `status: "PENDING"` to show them the list so they can choose.

## Recurring expense

Use `add_recurring_expense` for fixed services, subscriptions, or installments.

`frequency` param: `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `INTERVAL_DAYS`.
For `INTERVAL_DAYS`, `interval_days` is required.

Example: "I want to log that I pay Netflix every month for $15" → `add_recurring_expense` with frequency: MONTHLY.

## Currency not configured

If the tool response includes a suggestion to configure the currency, inform the user that their default currency is not set and offer to configure it now with `manage_currency`.
