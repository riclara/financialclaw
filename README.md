# financialclaw

[![CI](https://github.com/riclara/financialclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/riclara/financialclaw/actions/workflows/ci.yml)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/riclara/financialclaw)

> [Documentación en español](README.es.md)

Personal finance plugin for OpenClaw. Registers expenses, income, recurring payments, and generates summaries. Works with any OpenClaw-supported channel (Telegram, WhatsApp, etc.). Receipt OCR is handled agentically — if your channel supports sending images, you can photograph a receipt and the agent will extract the data automatically. Embedded SQLite database. Multi-currency support.

## Installation

```bash
openclaw plugins install @riclara/financialclaw
openclaw gateway restart
```

To use a custom database path (default: `~/.openclaw/workspace/financialclaw.db`), add it to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "financialclaw": {
        "config": {
          "dbPath": "/your/path/financialclaw.db"
        }
      }
    }
  }
}
```

## Available tools

| Tool | Description |
|---|---|
| `manage_currency` | Add currencies, list them, set the default |
| `log_expense_from_receipt` | Record an expense from structured OCR data |
| `log_expense_manual` | Record an expense manually |
| `log_income` | Record income |
| `log_income_receipt` | Record a payment received linked to an income |
| `add_recurring_expense` | Create a recurring expense rule |
| `mark_expense_paid` | Mark an existing expense as paid |
| `get_financial_summary` | Get a financial summary for a period |
| `list_expenses` | List expenses with filters |
| `list_incomes` | List incomes with filters |
| `run_daily_sync` | Run the daily sync: generate recurring expenses, mark overdue, send reminders |

## About Node.js and `better-sqlite3`

This project uses `better-sqlite3`, a native addon. The compiled binary depends on the active Node.js version.

- If you change Node versions, run `npm install` again before running tests or using the plugin.
- If you see `NODE_MODULE_VERSION` or `ERR_DLOPEN_FAILED` errors, running `npm install` usually fixes it.

## Documentation

- [README.es.md](README.es.md): documentación en español
- [docs/setup.md](docs/setup.md): full setup guide and troubleshooting — [español](docs/setup.es.md)
- [docs/hitos.md](docs/hitos.md): implementation status
- [docs/testing.md](docs/testing.md): testing strategy
