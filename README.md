# financialclaw

[![CI](https://github.com/riclara/financialclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/riclara/financialclaw/actions/workflows/ci.yml)

> [Documentación en español](README.es.md)

Personal finance plugin for OpenClaw via Telegram. Registers expenses (with agentic OCR for receipts), income, recurring payments, and generates summaries. Embedded SQLite database. Multi-currency support.

## Installation

```bash
openclaw plugins install @riclara/financialclaw
npx @riclara/financialclaw financialclaw-setup
openclaw gateway restart
```

`financialclaw-setup` automatically configures `plugins.allow` and `dbPath` in the OpenClaw config. Options:

```bash
# Custom database path (default: ~/.openclaw/workspace/financialclaw.db)
npx @riclara/financialclaw financialclaw-setup --db-path /your/path/financialclaw.db

# If the OpenClaw config is in a non-standard location
npx @riclara/financialclaw financialclaw-setup --config /path/to/openclaw.json
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

## About Node.js and `better-sqlite3`

This project uses `better-sqlite3`, a native addon. The compiled binary depends on the active Node.js version.

- If you change Node versions, run `npm install` again before running tests or using the plugin.
- If you see `NODE_MODULE_VERSION` or `ERR_DLOPEN_FAILED` errors, running `npm install` usually fixes it.

## Documentation

- [README.es.md](README.es.md): documentación en español
- [docs/setup.md](docs/setup.md): full setup guide and troubleshooting
- [docs/hitos.md](docs/hitos.md): implementation status
- [docs/testing.md](docs/testing.md): testing strategy
