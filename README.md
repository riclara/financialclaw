# financialclaw

[![CI](https://github.com/riclara/financialclaw/actions/workflows/ci.yml/badge.svg)](https://github.com/riclara/financialclaw/actions/workflows/ci.yml)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/riclara/financialclaw)

> [Documentación en español](README.es.md)

Personal finance plugin for OpenClaw. Registers expenses, income, recurring payments, and generates summaries. Works with any OpenClaw-supported channel (Telegram, WhatsApp, etc.). Receipt OCR is handled agentically — if your channel supports sending images, you can photograph a receipt and the agent will extract the data automatically. Embedded SQLite database. Multi-currency support.

## Installation

```bash
openclaw plugins install financialclaw
npx financialclaw financialclaw-setup
openclaw gateway restart
```

### Why is `financialclaw-setup` needed?

`openclaw plugins install` registers the plugin but does not add it to `plugins.allow`. Once that field exists, OpenClaw uses it as an explicit allowlist — anything not listed stops working, including active channels like Telegram.

`financialclaw-setup` reads your current config and applies three required changes:

1. **`plugins.allow`** — adds `financialclaw` alongside all active channels and plugins so nothing stops working.
2. **`tools.profile`** — sets it to `"full"`. Profiles like `"coding"` or `"minimal"` exclude plugin tools entirely, making them invisible to the agent.
3. **`tools.allow`** — adds `"financialclaw"` as an explicit tool allowlist entry.

It also sets `plugins.entries.financialclaw.config.dbPath` so the database persists across reinstalls (default: `~/.openclaw/workspace/financialclaw.db`).

### Options

```bash
# Custom database path
npx financialclaw financialclaw-setup --db-path /your/path/financialclaw.db

# If the OpenClaw config is in a non-standard location
npx financialclaw financialclaw-setup --config /path/to/openclaw.json
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

## Requirements

Node.js 24+ is required. The plugin uses `node:sqlite`, the built-in SQLite module available since Node.js 24 — no native addons or compilation needed.

## Documentation

- [README.es.md](README.es.md): documentación en español
- [docs/setup.md](docs/setup.md): full setup guide and troubleshooting — [español](docs/setup.es.md)
- [docs/hitos.md](docs/hitos.md): implementation status
- [docs/testing.md](docs/testing.md): testing strategy
