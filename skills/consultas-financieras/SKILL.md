---
name: consultas-financieras
description: |
  Query the user's financial status in financialclaw. Use when: the user asks how much they have spent, wants to see their expenses or income, requests a monthly or yearly summary, or asks about their overall financial situation. NOT for: logging new expenses or income, configuring currency.
metadata:
  {
    "openclaw": { "emoji": "📊" }
  }
---

# Financial queries

## General summary

Use `get_financial_summary` for a consolidated view of the period: total expenses by category, total income, balance, and active recurring commitments.

Periods: `this_month` (default), `last_month`, `last_30_days`, `this_year`.
Filter by `currency` if the user manages multiple currencies.

Examples:
- "How are my finances this month?" → `get_financial_summary`
- "Summary of last month's expenses" → period: last_month
- "Year-to-date balance" → period: this_year

## List expenses

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

## List income

Use `list_incomes` to see registered income.

Filters: `recurring` (true/false), `search`, `currency`, `include_receipts` (shows received payments per income).

Examples:
- "What income do I have?" → `list_incomes`
- "My recurring income" → recurring: true
- "Income with payment details" → include_receipts: true
