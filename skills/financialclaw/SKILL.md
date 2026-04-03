---
name: financialclaw
description: |
  Personal finance management via financialclaw. Use when: the user mentions spending money, buying something, paying a bill, sending a receipt photo, receiving money or salary, asking about their financial status, wanting to see expenses or income, setting up recurring payments, or configuring their currency. NOT for: topics unrelated to personal finance.
metadata:
  {
    "openclaw": { "emoji": "💰" }
  }
---

# financialclaw — Personal finance

## First-time setup check

On the **very first financial interaction** with a user (before responding to their request), let them know you are checking their setup and call `manage_currency` with `action: "list"`.

- If the call **succeeds**: briefly confirm that the setup looks good and proceed with their request.
- If the call **fails with any error** (database error, module not found, tool unavailable, etc.): stop immediately and show this exact message, nothing else:

  > "financialclaw needs a one-time setup. Run these two commands and come back:
  >
  > ```
  > npx financialclaw financialclaw-setup
  > openclaw gateway restart
  > ```"

  Do **not** offer alternatives. Do **not** try to diagnose the error further. Do **not** make any other tool calls. Wait for the user to confirm they ran the commands.

Only perform this check once per session. If a tool call already succeeded earlier in the session, skip it.

---

## Expense logging

### Manual expense

Use `log_expense_manual` when the user describes an expense in words (no photo).

Required params: `amount`, `description`.
Optional params: `category`, `currency`, `merchant`, `due_date`.

If the amount is missing, ask before logging. If the date is missing, today is used by default (the tool handles this automatically).

Available categories: `HOUSING`, `SERVICES`, `TRANSPORT`, `SUPERMARKET`, `HEALTH`, `EDUCATION`, `ENTERTAINMENT`, `RESTAURANT`, `OTHER`.

Examples:
- "I spent $50 at the supermarket" → `log_expense_manual` with category: SUPERMARKET
- "I paid rent" → ask for the amount if not given
- "Lunch for $18 at Crepes & Waffles" → include merchant

### Expense from receipt photo

Use `log_expense_from_receipt` when the user sends a photo of a receipt, ticket, or invoice.

Mandatory flow — do not skip any step:

1. Extract from the receipt using your vision capabilities:
   - `amount`: the receipt total (number, no currency symbols or thousand separators)
   - `date`: date in YYYY-MM-DD format
   - `merchant`: name of the establishment
   - `category`: infer from the type of business
   - `raw_text`: all visible text from the receipt

2. Before invoking the tool, show the extracted data to the user and ask for confirmation:

   > "Here's what I found on the receipt — is this correct?
   > • Amount: [amount]
   > • Date: [date]
   > • Merchant: [merchant]
   > • Category: [category]"

   If the channel is Telegram: send the message with an inline button "Yes ✅" using an interactive block (`type: "buttons"`, `label: "Yes ✅"`, `value: "si"`). The user can press the button to confirm, or type directly what needs to be corrected.

   If the channel is not Telegram: ask for confirmation in plain text ("Reply 'yes' to save or tell me what to correct").

3. Only call `log_expense_from_receipt` after the user confirms (button or affirmative text) or after applying the corrections they indicate.

### Mark expense as paid

Use `mark_expense_paid` when the user confirms they paid a pending expense.

You need the `expense_id`. If the user doesn't have it handy, use `list_expenses` with `status: "PENDING"` to show them the list so they can choose.

### Recurring expense

Use `add_recurring_expense` for fixed services, subscriptions, or installments.

`frequency` param: `WEEKLY`, `BIWEEKLY`, `MONTHLY`, `INTERVAL_DAYS`.
For `INTERVAL_DAYS`, `interval_days` is required.

Example: "I want to log that I pay Netflix every month for $15" → `add_recurring_expense` with frequency: MONTHLY.

---

## Income logging

### New income

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

### Payment received on existing income

Use `log_income_receipt` when the user reports receiving an installment or payment against an already registered income (not a new one).

Requires `income_id`. If the user doesn't have it, use `list_incomes` first to show them.

Required params: `income_id`, `amount`, `date`.
Optional param: `notes`.

Example: "I received the March payment from client X" → find the income_id with `list_incomes`, then use `log_income_receipt`.

---

## Financial queries

### General summary

Use `get_financial_summary` for a consolidated view of the period: total expenses by category, total income, balance, and active recurring commitments.

Periods: `this_month` (default), `last_month`, `last_30_days`, `this_year`.
Filter by `currency` if the user manages multiple currencies.

Examples:
- "How are my finances this month?" → `get_financial_summary`
- "Summary of last month's expenses" → period: last_month
- "Year-to-date balance" → period: this_year

### List expenses

Use `list_expenses` to see individual expenses with filters.

Available filters:
- `period`: `this_month`, `last_month`, `last_30_days`, `this_year`, `all`
- `status`: `PENDING`, `PAID`, `OVERDUE`
- `category`: category name
- `search`: search in description or merchant
- `source`: `manual` or `ocr`
- `limit` / `offset`: pagination (default 20, max 50)

Examples:
- "Show me pending expenses" → status: PENDING
- "How much did I spend at the supermarket?" → category: SUPERMARKET
- "Transport expenses in the last 30 days" → period: last_30_days, category: TRANSPORT

If there are more results than shown, let the user know they can request more using offset.

### List income

Use `list_incomes` to see registered income.

Filters: `recurring` (true/false), `search`, `currency`, `include_receipts` (shows received payments per income).

Examples:
- "What income do I have?" → `list_incomes`
- "My recurring income" → recurring: true
- "Income with payment details" → include_receipts: true

---

## Currency configuration

Use `manage_currency` with the appropriate action.

### Add currency

Action: `add`
Params: `code` (ISO 4217), `name`, `symbol`

Common currencies: COP / Colombian peso / $, USD / US dollar / $, EUR / Euro / €, MXN / Mexican peso / $, ARS / Argentine peso / $

### List currencies

Action: `list`
Shows all configured currencies. The default currency is marked.

### Set default currency

Action: `set_default`
Param: `code`

### First-time setup flow

If the active currency is XXX (not yet configured), guide the user as follows:

1. Inform them that the currency is not configured and amounts will show with the `¤` symbol
2. Ask which currency they primarily use
3. Use `add` to register it with the correct code, name, and symbol
4. Use `set_default` to set it as the default
5. Confirm the change by showing the configured currency name and symbol

---

## Daily sync and automatic reminders

### Automatic setup (first interaction)

On the **first financial interaction of the session**, call `cron.list` and check for a job named `financialclaw-daily-sync`.

- If **not found**: ask the user if they would like to enable daily payment reminders (sent every day at 9 AM). Explain briefly what it does: "I can send you a daily summary of pending and overdue payments every morning. Would you like to enable this?"

  - If the user **accepts**: create the job using `cron.add`. Use the current session's channel and conversation target for delivery.

  ```json
  {
    "name": "financialclaw-daily-sync",
    "schedule": { "kind": "cron", "expr": "0 9 * * *" },
    "sessionTarget": "isolated",
    "payload": {
      "kind": "agentTurn",
      "message": "Call run_daily_sync. If there are pending reminders, present them clearly: description, amount, due date, and how many days remain. If everything is up to date, say so in one short sentence."
    },
    "delivery": {
      "mode": "announce",
      "channel": "<current channel>",
      "to": "<current conversation target>"
    }
  }
  ```

  - If the user **declines**: respect their choice and do not ask again during this session. The user can enable it later by asking.

- If **already found**: do nothing. Do not recreate or mention it.

### Manual sync

Use `run_daily_sync` when:
- The user asks "what do I have pending?", "what's due?", "run the daily sync"
- The user wants to see overdue or upcoming recurring expenses right now

The tool generates pending recurring expense instances, marks overdue ones, and returns the list of payment reminders due today.

### User-requested reminder management

If the user asks to change, disable, or inspect the daily reminder:

| Request | Action |
|---|---|
| Change reminder time | `cron.update` with new schedule |
| Disable reminders | `cron.update` with `enabled: false` |
| Re-enable reminders | `cron.update` with `enabled: true` |
| See reminder status | `cron.list`, filter by `financialclaw-daily-sync` |
| Run sync now | `run_daily_sync` |

---

## Currency not configured

If any tool response includes a suggestion to configure the currency, inform the user that their default currency is not set and offer to configure it now with `manage_currency`.
